import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { Brand as BrandDto } from '@isd/shared-types';

import { SluggableService } from '@/common/services/sluggable.service';
import { notDeleted } from '@/database/schema.helpers';
import { CacheTag, RevalidationService } from '@/modules/revalidation/revalidation.service';
import { Product, ProductDocument } from '@/modules/products/product.schema';
import { Brand, BrandDocument } from './brand.schema';
import type { CreateBrandDto } from './dto/create-brand.dto';
import type { UpdateBrandDto } from './dto/update-brand.dto';

/** Raw document shape: ObjectId and Date, converted to strings by toDto. */
type LeanBrand = Brand & { _id: Types.ObjectId };

@Injectable()
export class BrandService extends SluggableService<BrandDocument> {
  constructor(
    @InjectModel(Brand.name) brandModel: Model<BrandDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly revalidation: RevalidationService,
  ) {
    super(brandModel, 'Brand');
  }

  async findAll(options: { includeInactive?: boolean } = {}): Promise<BrandDto[]> {
    const filter = options.includeInactive ? notDeleted() : { ...notDeleted(), isActive: true };

    const brands = await this.model.find(filter).sort({ displayOrder: 1, name: 1 }).lean().exec();

    return (brands as unknown as LeanBrand[]).map((brand) => this.toDto(brand));
  }

  async findBySlug(slug: string): Promise<BrandDto> {
    const brand = await this.model
      .findOne({ slug: slug.toLowerCase(), ...notDeleted(), isActive: true })
      .lean()
      .exec();

    if (!brand) throw new NotFoundException(`No brand found for '${slug}'.`);
    return this.toDto(brand);
  }

  async findById(id: string): Promise<BrandDto> {
    const brand = await this.model
      .findOne({ _id: id, ...notDeleted() })
      .lean()
      .exec();
    if (!brand) throw new NotFoundException('Brand not found.');
    return this.toDto(brand);
  }

  /** Resolves slugs to ids for the product listing filter. */
  async resolveSlugs(slugs: string[]): Promise<Types.ObjectId[]> {
    if (!slugs.length) return [];

    const brands = await this.model
      .find({ slug: { $in: slugs.map((slug) => slug.toLowerCase()) }, ...notDeleted() })
      .select('_id')
      .lean()
      .exec();

    return (brands as unknown as { _id: Types.ObjectId }[]).map((brand) => brand._id);
  }

  async create(dto: CreateBrandDto): Promise<BrandDto> {
    const slug = await this.ensureUniqueSlug(dto.slug ?? dto.name);
    const created = await this.model.create({ ...dto, slug });

    this.revalidateFor(slug);
    return this.toDto(created.toObject());
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandDto> {
    const brand = await this.findOrThrow(id);
    const previousSlug = brand.slug;

    if (dto.slug && dto.slug !== brand.slug) {
      brand.slug = await this.ensureUniqueSlug(dto.slug, id);
    }

    for (const key of [
      'name',
      'logo',
      'banner',
      'description',
      'displayOrder',
      'isActive',
      'seo',
    ] as const) {
      if (dto[key] !== undefined) {
        (brand as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }

    await brand.save();
    this.revalidateFor(brand.slug, previousSlug);
    return this.toDto(brand.toObject());
  }

  /**
   * Soft delete, blocked while products still reference the brand.
   *
   * Same reasoning as categories: a brand's products are hand-entered, and
   * nulling their brand as a side effect of a delete is not something an admin
   * would expect from clicking a trash icon.
   */
  async remove(id: string): Promise<{ deleted: true }> {
    const brand = await this.findOrThrow(id);

    const productCount = await this.productModel
      .countDocuments({ brand: brand._id, ...notDeleted() })
      .exec();

    if (productCount > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `'${brand.name}' is still assigned to ${productCount} product${
          productCount === 1 ? '' : 's'
        }. Reassign them first.`,
        details: [{ field: 'products', message: String(productCount) }],
      });
    }

    brand.isDeleted = true;
    brand.deletedAt = new Date();
    await brand.save();

    this.revalidateFor(brand.slug);
    return { deleted: true };
  }

  private revalidateFor(slug: string, previousSlug?: string): void {
    const tags = [CacheTag.brandsList, CacheTag.brand(slug), CacheTag.productsList, CacheTag.home];
    if (previousSlug && previousSlug !== slug) tags.push(CacheTag.brand(previousSlug));
    this.revalidation.revalidate(tags);
  }

  private toDto(brand: LeanBrand): BrandDto {
    return {
      _id: String(brand._id),
      name: brand.name,
      slug: brand.slug,
      logo: brand.logo,
      banner: brand.banner,
      description: brand.description,
      displayOrder: brand.displayOrder,
      isActive: brand.isActive,
      seo: brand.seo,
      createdAt: new Date(brand.createdAt).toISOString(),
      updatedAt: new Date(brand.updatedAt).toISOString(),
    };
  }
}
