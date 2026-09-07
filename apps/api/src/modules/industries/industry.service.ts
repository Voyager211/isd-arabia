import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { Industry as IndustryDto } from '@isd/shared-types';

import { SluggableService } from '@/common/services/sluggable.service';
import { sanitizeRichText } from '@/common/utils/sanitize.util';
import { notDeleted } from '@/database/schema.helpers';
import { CacheTag, RevalidationService } from '@/modules/revalidation/revalidation.service';
import { Product, ProductDocument } from '@/modules/products/product.schema';
import { Industry, IndustryDocument } from './industry.schema';
import type { CreateIndustryDto } from './dto/create-industry.dto';
import type { UpdateIndustryDto } from './dto/update-industry.dto';

/** Raw document shape: ObjectId and Date, converted to strings by toDto. */
type LeanIndustry = Industry & { _id: Types.ObjectId };

@Injectable()
export class IndustryService extends SluggableService<IndustryDocument> {
  constructor(
    @InjectModel(Industry.name) industryModel: Model<IndustryDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly revalidation: RevalidationService,
  ) {
    super(industryModel, 'Industry');
  }

  async findAll(options: { includeInactive?: boolean } = {}): Promise<IndustryDto[]> {
    const filter = options.includeInactive ? notDeleted() : { ...notDeleted(), isActive: true };

    const industries = await this.model
      .find(filter)
      // The list view never needs the long-form body; excluding it keeps the
      // footer and home-page payloads small on every request.
      .select('-content')
      .sort({ displayOrder: 1, name: 1 })
      .lean()
      .exec();

    return (industries as unknown as LeanIndustry[]).map((industry) => this.toDto(industry));
  }

  async findBySlug(slug: string): Promise<IndustryDto> {
    const industry = await this.model
      .findOne({ slug: slug.toLowerCase(), ...notDeleted(), isActive: true })
      .lean()
      .exec();

    if (!industry) throw new NotFoundException(`No industry found for '${slug}'.`);
    return this.toDto(industry);
  }

  async findById(id: string): Promise<IndustryDto> {
    const industry = await this.model
      .findOne({ _id: id, ...notDeleted() })
      .lean()
      .exec();
    if (!industry) throw new NotFoundException('Industry not found.');
    return this.toDto(industry);
  }

  async resolveSlugs(slugs: string[]): Promise<Types.ObjectId[]> {
    if (!slugs.length) return [];

    const industries = await this.model
      .find({ slug: { $in: slugs.map((slug) => slug.toLowerCase()) }, ...notDeleted() })
      .select('_id')
      .lean()
      .exec();

    return (industries as unknown as { _id: Types.ObjectId }[]).map((industry) => industry._id);
  }

  async create(dto: CreateIndustryDto): Promise<IndustryDto> {
    const slug = await this.ensureUniqueSlug(dto.slug ?? dto.name);

    const created = await this.model.create({
      ...dto,
      slug,
      // Sanitised on write, never on read: the database then only ever holds
      // safe markup, so a future consumer that forgets to sanitise cannot be
      // the hole (PROJECT_PLAN.md §12.3).
      content: sanitizeRichText(dto.content),
    });

    this.revalidateFor(slug);
    return this.toDto(created.toObject());
  }

  async update(id: string, dto: UpdateIndustryDto): Promise<IndustryDto> {
    const industry = await this.findOrThrow(id);
    const previousSlug = industry.slug;

    if (dto.slug && dto.slug !== industry.slug) {
      industry.slug = await this.ensureUniqueSlug(dto.slug, id);
    }

    if (dto.content !== undefined) {
      industry.content = sanitizeRichText(dto.content);
    }

    for (const key of [
      'name',
      'icon',
      'banner',
      'description',
      'displayOrder',
      'isActive',
      'seo',
    ] as const) {
      if (dto[key] !== undefined) {
        (industry as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }

    await industry.save();
    this.revalidateFor(industry.slug, previousSlug);
    return this.toDto(industry.toObject());
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const industry = await this.findOrThrow(id);

    const productCount = await this.productModel
      .countDocuments({ industries: industry._id, ...notDeleted() })
      .exec();

    if (productCount > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `'${industry.name}' is still assigned to ${productCount} product${
          productCount === 1 ? '' : 's'
        }. Reassign them first.`,
        details: [{ field: 'products', message: String(productCount) }],
      });
    }

    industry.isDeleted = true;
    industry.deletedAt = new Date();
    await industry.save();

    this.revalidateFor(industry.slug);
    return { deleted: true };
  }

  private revalidateFor(slug: string, previousSlug?: string): void {
    const tags = [
      CacheTag.industriesList,
      CacheTag.industry(slug),
      CacheTag.productsList,
      CacheTag.home,
    ];
    if (previousSlug && previousSlug !== slug) tags.push(CacheTag.industry(previousSlug));
    this.revalidation.revalidate(tags);
  }

  private toDto(industry: LeanIndustry): IndustryDto {
    return {
      _id: String(industry._id),
      name: industry.name,
      slug: industry.slug,
      icon: industry.icon,
      banner: industry.banner,
      description: industry.description,
      content: industry.content,
      displayOrder: industry.displayOrder,
      isActive: industry.isActive,
      seo: industry.seo,
      createdAt: new Date(industry.createdAt).toISOString(),
      updatedAt: new Date(industry.updatedAt).toISOString(),
    };
  }
}
