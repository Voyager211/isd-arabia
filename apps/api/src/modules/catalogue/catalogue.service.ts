import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';

import type {
  CatalogueDownloadResponse,
  CatalogueFile as CatalogueFileDto,
  CatalogueLead as CatalogueLeadDto,
  CataloguePublic,
  PaginationMeta,
  RequestMeta,
} from '@isd/shared-types';

import { buildPaginationMeta, skipFor } from '@/common/utils/pagination.util';
import { notDeleted } from '@/database/schema.helpers';
import { CacheTag, RevalidationService } from '@/modules/revalidation/revalidation.service';
import { CloudinaryService } from '@/modules/uploads/cloudinary.service';
import { CatalogueFile, CatalogueFileDocument } from './catalogue-file.schema';
import { CatalogueLead, CatalogueLeadDocument } from './catalogue-lead.schema';
import type {
  CatalogueDownloadDto,
  CatalogueLeadQueryDto,
  CreateCatalogueFileDto,
  UpdateCatalogueFileDto,
} from './dto/catalogue.dto';

@Injectable()
export class CatalogueService {
  private readonly logger = new Logger(CatalogueService.name);

  constructor(
    @InjectModel(CatalogueFile.name)
    private readonly fileModel: Model<CatalogueFileDocument>,
    @InjectModel(CatalogueLead.name)
    private readonly leadModel: Model<CatalogueLeadDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly cloudinary: CloudinaryService,
    private readonly revalidation: RevalidationService,
  ) {}

  // ── Public ──────────────────────────────────────────────────────────────

  /**
   * Metadata for the download card (PROJECT_PLAN.md §8.1).
   *
   * Deliberately carries NO file URL when the file is gated. Returning it and
   * relying on the frontend not to render it would make the lead form
   * decorative — anyone reading the network tab would have the PDF.
   */
  async getActive(): Promise<CataloguePublic | null> {
    const file = await this.fileModel
      .findOne({ ...notDeleted(), isActive: true })
      .lean()
      .exec();

    if (!file) return null;

    return {
      _id: String(file._id),
      title: file.title,
      description: file.description,
      version: file.version,
      sizeBytes: file.file.sizeBytes,
      pageCount: file.file.pageCount,
      coverImage: file.coverImage
        ? { url: file.coverImage.url, alt: file.coverImage.alt }
        : undefined,
      requiresLead: file.requiresLead,
      // Only when the gate is off — then the storefront links straight to it.
      downloadUrl: file.requiresLead
        ? undefined
        : this.cloudinary.buildSignedDownloadUrl(file.file.publicId).url,
    };
  }

  /**
   * Captures a lead and hands back a short-lived signed URL.
   *
   * The URL expires in 15 minutes so it cannot be shared onward to bypass the
   * form (§13.3). A permanent public URL would make the whole gate pointless
   * the first time someone posted it in a group chat.
   */
  async requestDownload(
    dto: CatalogueDownloadDto,
    meta: RequestMeta,
  ): Promise<CatalogueDownloadResponse> {
    const file = await this.fileModel.findOne({ ...notDeleted(), isActive: true }).exec();

    if (!file) {
      throw new NotFoundException('No catalogue is available for download right now.');
    }

    await this.leadModel.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      company: dto.company,
      catalogue: file._id,
      // Snapshotted so the leads table still reads correctly after the file is
      // replaced by next year's edition.
      catalogueTitle: file.title,
      meta,
    });

    // Not awaited on the critical path — the count is a reporting figure, and
    // a failed increment must not cost the visitor their download.
    void this.fileModel
      .updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } })
      .exec()
      .catch((error: Error) => {
        this.logger.error(`Failed to increment downloadCount: ${error.message}`);
      });

    const { url, expiresAt } = this.cloudinary.buildSignedDownloadUrl(file.file.publicId);

    return { downloadUrl: url, expiresAt: expiresAt.toISOString() };
  }

  // ── Admin: files ────────────────────────────────────────────────────────

  async findAll(): Promise<CatalogueFileDto[]> {
    const files = await this.fileModel
      .find(notDeleted())
      .sort({ isActive: -1, displayOrder: 1, createdAt: -1 })
      .lean()
      .exec();

    return files.map((file) => this.toDto(file as unknown as CatalogueFileRow));
  }

  async create(dto: CreateCatalogueFileDto): Promise<CatalogueFileDto> {
    const created = await this.fileModel.create(dto);

    // The first file uploaded becomes the active one — otherwise an admin
    // uploads a catalogue, sees nothing on the storefront, and has to discover
    // the activation toggle to make anything happen.
    const activeCount = await this.fileModel
      .countDocuments({ ...notDeleted(), isActive: true })
      .exec();

    if (activeCount === 0) {
      return this.activate(String(created._id));
    }

    this.revalidation.revalidate([CacheTag.catalogue, CacheTag.home]);
    return this.toDto(created.toObject() as unknown as CatalogueFileRow);
  }

  async update(id: string, dto: UpdateCatalogueFileDto): Promise<CatalogueFileDto> {
    const file = await this.fileModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!file) throw new NotFoundException('Catalogue file not found.');

    for (const key of [
      'title',
      'description',
      'coverImage',
      'version',
      'requiresLead',
      'displayOrder',
    ] as const) {
      if (dto[key] !== undefined) {
        (file as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }

    await file.save();
    this.revalidation.revalidate([CacheTag.catalogue, CacheTag.home]);

    return this.toDto(file.toObject() as unknown as CatalogueFileRow);
  }

  /**
   * Makes one file active and deactivates every other, atomically.
   *
   * Run in a transaction (PROJECT_PLAN.md §14.1). Atlas M0 is a three-node
   * replica set, so transactions are available there. Without one there is a
   * window between the deactivate and the activate in which the storefront
   * sees zero active catalogues — or, if the order were reversed, two.
   *
   * Falls back to the sequential path on a standalone mongod, which is what a
   * local dev machine or the e2e harness runs. The window exists there, and
   * that is an acceptable trade for being able to run the suite at all.
   */
  async activate(id: string): Promise<CatalogueFileDto> {
    const target = await this.fileModel
      .findOne({ _id: id, ...notDeleted() })
      .lean()
      .exec();
    if (!target) throw new NotFoundException('Catalogue file not found.');

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        await this.fileModel
          .updateMany({ _id: { $ne: target._id } }, { $set: { isActive: false } })
          .session(session)
          .exec();

        await this.fileModel
          .updateOne({ _id: target._id }, { $set: { isActive: true } })
          .session(session)
          .exec();
      });
    } catch (error) {
      if (!isUnsupportedTransactionError(error)) throw error;

      this.logger.warn(
        'Transactions are unavailable on this deployment (standalone mongod). ' +
          'Activating sequentially — there is a brief window with no active catalogue. ' +
          'Atlas is a replica set, so this path is not taken in production.',
      );

      await this.fileModel
        .updateMany({ _id: { $ne: target._id } }, { $set: { isActive: false } })
        .exec();
      await this.fileModel.updateOne({ _id: target._id }, { $set: { isActive: true } }).exec();
    } finally {
      await session.endSession();
    }

    this.revalidation.revalidate([CacheTag.catalogue, CacheTag.home]);

    const updated = await this.fileModel.findById(target._id).lean().exec();
    return this.toDto(updated as unknown as CatalogueFileRow);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const file = await this.fileModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!file) throw new NotFoundException('Catalogue file not found.');

    file.isDeleted = true;
    file.deletedAt = new Date();
    file.isActive = false;
    await file.save();

    // The Cloudinary asset is kept: a soft delete is reversible, and the leads
    // that reference this file are not.
    this.revalidation.revalidate([CacheTag.catalogue, CacheTag.home]);
    return { deleted: true };
  }

  // ── Admin: leads ────────────────────────────────────────────────────────

  async findLeads(
    query: CatalogueLeadQueryDto,
  ): Promise<{ data: CatalogueLeadDto[]; meta: PaginationMeta }> {
    const filter = this.buildLeadFilter(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const [rows, total] = await Promise.all([
      this.leadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skipFor(page, limit))
        .limit(limit)
        .lean()
        .exec(),
      this.leadModel.countDocuments(filter).exec(),
    ]);

    return {
      data: rows.map((row) => this.toLeadDto(row as unknown as CatalogueLeadRow)),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findAllLeadsForExport(query: CatalogueLeadQueryDto): Promise<CatalogueLeadDto[]> {
    const rows = await this.leadModel
      .find(this.buildLeadFilter(query))
      .sort({ createdAt: -1 })
      .limit(10_000)
      .lean()
      .exec();

    return rows.map((row) => this.toLeadDto(row as unknown as CatalogueLeadRow));
  }

  /** Dashboard figure. */
  async countLeadsSince(date: Date): Promise<number> {
    return this.leadModel.countDocuments({ ...notDeleted(), createdAt: { $gte: date } }).exec();
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private buildLeadFilter(query: CatalogueLeadQueryDto): FilterQuery<CatalogueLeadDocument> {
    const filter: FilterQuery<CatalogueLeadDocument> = { ...notDeleted() };

    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = new Date(query.from);
      if (query.to) {
        const to = new Date(query.to);
        to.setUTCHours(23, 59, 59, 999);
        range.$lte = to;
      }
      filter.createdAt = range;
    }

    const term = query.q?.trim();
    if (term) {
      // Escaped: an unescaped '(' from the search box would throw.
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: pattern }, { company: pattern }, { email: pattern }];
    }

    return filter;
  }

  private toDto(file: CatalogueFileRow): CatalogueFileDto {
    return {
      _id: String(file._id),
      title: file.title,
      description: file.description,
      file: {
        url: file.file.url,
        publicId: file.file.publicId,
        sizeBytes: file.file.sizeBytes,
        pageCount: file.file.pageCount,
      },
      coverImage: file.coverImage
        ? {
            url: file.coverImage.url,
            publicId: file.coverImage.publicId,
            alt: file.coverImage.alt,
          }
        : undefined,
      version: file.version,
      requiresLead: file.requiresLead,
      downloadCount: file.downloadCount,
      isActive: file.isActive,
      displayOrder: file.displayOrder,
      createdAt: new Date(file.createdAt).toISOString(),
      updatedAt: new Date(file.updatedAt).toISOString(),
    };
  }

  private toLeadDto(lead: CatalogueLeadRow): CatalogueLeadDto {
    return {
      _id: String(lead._id),
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      catalogue: String(lead.catalogue),
      catalogueTitle: lead.catalogueTitle,
      meta: lead.meta,
      createdAt: new Date(lead.createdAt).toISOString(),
      updatedAt: new Date(lead.updatedAt).toISOString(),
    };
  }
}

type CatalogueFileRow = CatalogueFile & { _id: Types.ObjectId };
type CatalogueLeadRow = CatalogueLead & { _id: Types.ObjectId };

/**
 * A standalone mongod rejects transactions with a specific code. Matching on
 * that rather than on the message text, which varies between server versions.
 */
function isUnsupportedTransactionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const { code, codeName, message } = error as {
    code?: number | string;
    codeName?: string;
    message?: string;
  };

  return (
    code === 20 ||
    codeName === 'IllegalOperation' ||
    /Transaction numbers are only allowed on a replica set|Transactions are not supported/i.test(
      message ?? '',
    )
  );
}
