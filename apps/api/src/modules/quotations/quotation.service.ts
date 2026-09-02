import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';

import type {
  PaginationMeta,
  Quotation as QuotationDto,
  QuotationItemRejection,
  QuotationStatus,
  QuotationSummary,
  RequestMeta,
  SubmitQuotationResponse,
} from '@isd/shared-types';
import { QUOTATION_STATUS_TRANSITIONS } from '@isd/shared-types';

import { buildPaginationMeta, skipFor } from '@/common/utils/pagination.util';
import { notDeleted } from '@/database/schema.helpers';
import { CounterService } from '@/database/counter.service';
import { Product, ProductDocument } from '@/modules/products/product.schema';
import { MailService } from '@/modules/mail/mail.service';
import { Quotation, QuotationDocument, QuotationItem } from './quotation.schema';
import type { SubmitQuotationDto } from './dto/submit-quotation.dto';
import type { QuotationListQueryDto } from './dto/quotation-admin.dto';

@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);

  constructor(
    @InjectModel(Quotation.name) private readonly quotationModel: Model<QuotationDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly counters: CounterService,
    private readonly mail: MailService,
  ) {}

  // ── Public submission ───────────────────────────────────────────────────

  /**
   * Accepts a quotation request (PROJECT_PLAN.md §8.1, §10).
   *
   * Two rules govern this method:
   *
   *  1. **Every product is re-read from the database.** Name, SKU, image and
   *     unit come from the record, never from the request body. The client
   *     holds this data in localStorage where anyone can edit it, so trusting
   *     it would let a submitter write whatever they liked onto a quotation.
   *
   *  2. **A stale line rejects the whole submission with 422**, naming the
   *     offending indexes so the frontend can highlight them and offer to
   *     remove them — the rest of the cart survives. Silently dropping them
   *     would send the customer a confirmation for a request that is missing
   *     items they asked for.
   */
  async submit(dto: SubmitQuotationDto, meta: RequestMeta): Promise<SubmitQuotationResponse> {
    const { items, rejections } = await this.buildSnapshot(dto.items);

    if (rejections.length) {
      throw new UnprocessableEntityException({
        code: 'UNPROCESSABLE_ENTITY',
        message:
          'Some items are no longer available. Remove them and submit the rest of your request.',
        details: rejections.map((rejection) => ({
          field: `items[${rejection.index}]`,
          message: rejection.reason,
        })),
        rejections,
      });
    }

    /**
     * Atomic, from the Counter collection. `countDocuments() + 1` races under
     * concurrent submissions and produces duplicate quote numbers — acceptance
     * criterion #28 exists specifically to catch that.
     */
    const quoteNumber = await this.counters.nextQuoteNumber();

    const quotation = await this.quotationModel.create({
      quoteNumber,
      customer: dto.customer,
      address: { ...dto.address, country: dto.address.country || 'Saudi Arabia' },
      items,
      message: dto.message,
      status: 'new',
      statusHistory: [],
      adminNotes: [],
      meta,
    });

    // Fire and forget. The record is committed; a dead SMTP relay must not
    // stop the customer seeing their quote number.
    void this.mail.notifyNewQuotation(quotation.toObject());

    return {
      quoteNumber,
      submittedAt: quotation.createdAt.toISOString(),
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
    };
  }

  /**
   * Re-reads every referenced product and snapshots it.
   *
   * One query for all of them rather than one per line — a 200-line request
   * would otherwise be 200 round trips on a shared-CPU tier.
   */
  private async buildSnapshot(
    lines: SubmitQuotationDto['items'],
  ): Promise<{ items: QuotationItem[]; rejections: QuotationItemRejection[] }> {
    const ids = lines.map((line) => new Types.ObjectId(line.productId));

    const products = await this.productModel
      .find({ _id: { $in: ids } })
      .select('name sku images unit isActive isDeleted minOrderQuantity')
      .lean()
      .exec();

    const byId = new Map(products.map((product) => [String(product._id), product]));

    const items: QuotationItem[] = [];
    const rejections: QuotationItemRejection[] = [];

    lines.forEach((line, index) => {
      const product = byId.get(line.productId);

      if (!product) {
        rejections.push({ index, productId: line.productId, reason: 'not_found' });
        return;
      }
      if (product.isDeleted) {
        rejections.push({ index, productId: line.productId, reason: 'deleted' });
        return;
      }
      if (!product.isActive) {
        rejections.push({ index, productId: line.productId, reason: 'inactive' });
        return;
      }

      items.push({
        product: product._id,
        // Snapshotted. Never populated on read — see the schema comment.
        name: product.name,
        sku: product.sku,
        imageUrl: product.images?.[0]?.url ?? '',
        unit: product.unit,
        // The minimum order quantity is enforced here as well as in the UI: a
        // request assembled by editing localStorage should not undercut it.
        quantity: Math.max(line.quantity, product.minOrderQuantity || 1),
        note: line.note?.trim() || undefined,
      });
    });

    return { items, rejections };
  }

  // ── Admin reads ─────────────────────────────────────────────────────────

  async list(
    query: QuotationListQueryDto,
  ): Promise<{ data: QuotationSummary[]; meta: PaginationMeta }> {
    const filter = this.buildFilter(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const [rows, total] = await Promise.all([
      this.quotationModel
        .find(filter)
        .select('quoteNumber createdAt customer items status')
        .sort({ createdAt: -1 })
        .skip(skipFor(page, limit))
        .limit(limit)
        .lean()
        .exec(),
      this.quotationModel.countDocuments(filter).exec(),
    ]);

    return {
      data: rows.map((row) => this.toSummary(row as unknown as QuotationRow)),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findById(id: string): Promise<QuotationDto> {
    const quotation = await this.quotationModel
      .findOne({ _id: id, ...notDeleted() })
      .lean()
      .exec();

    if (!quotation) throw new NotFoundException('Quotation not found.');
    return this.toDto(quotation as unknown as QuotationRow);
  }

  /** Every matching row, for the CSV export. Bounded so it cannot run away. */
  async findAllForExport(query: QuotationListQueryDto): Promise<QuotationDto[]> {
    const rows = await this.quotationModel
      .find(this.buildFilter(query))
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean()
      .exec();

    return rows.map((row) => this.toDto(row as unknown as QuotationRow));
  }

  // ── Admin writes ────────────────────────────────────────────────────────

  /**
   * Moves a quotation to a new status and records who did it.
   *
   * The transition table is enforced here rather than only in the UI: the
   * status history is the client's audit trail of a commercial conversation,
   * and a quotation jumping from `new` straight to `won` with no intermediate
   * record makes that trail useless.
   */
  async updateStatus(
    id: string,
    status: QuotationStatus,
    admin: { id: string; name?: string },
    note?: string,
  ): Promise<QuotationDto> {
    const quotation = await this.quotationModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!quotation) throw new NotFoundException('Quotation not found.');

    if (quotation.status === status) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `This quotation is already marked '${status}'.`,
      });
    }

    const allowed = QUOTATION_STATUS_TRANSITIONS[quotation.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `A quotation cannot move from '${quotation.status}' to '${status}'.`,
        details: [{ field: 'status', message: `Allowed: ${allowed.join(', ') || 'none'}.` }],
      });
    }

    quotation.statusHistory.push({
      from: quotation.status,
      to: status,
      changedBy: new Types.ObjectId(admin.id),
      // Snapshotted so the history stays readable if the account is removed.
      changedByName: admin.name,
      note: note?.trim() || undefined,
      changedAt: new Date(),
    });

    quotation.status = status;
    await quotation.save();

    return this.toDto(quotation.toObject() as unknown as QuotationRow);
  }

  async addNote(
    id: string,
    note: string,
    admin: { id: string; name?: string },
  ): Promise<QuotationDto> {
    const quotation = await this.quotationModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!quotation) throw new NotFoundException('Quotation not found.');

    quotation.adminNotes.push({
      note: note.trim(),
      addedBy: new Types.ObjectId(admin.id),
      addedByName: admin.name,
      addedAt: new Date(),
    });

    await quotation.save();
    return this.toDto(quotation.toObject() as unknown as QuotationRow);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const quotation = await this.quotationModel.findOne({ _id: id, ...notDeleted() }).exec();
    if (!quotation) throw new NotFoundException('Quotation not found.');

    // Soft delete only. A quotation is a record of a commercial conversation
    // and the client may need it back.
    quotation.isDeleted = true;
    quotation.deletedAt = new Date();
    await quotation.save();

    return { deleted: true };
  }

  // ── Dashboard support ───────────────────────────────────────────────────

  async countSince(date: Date): Promise<number> {
    return this.quotationModel
      .countDocuments({ ...notDeleted(), createdAt: { $gte: date } })
      .exec();
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.quotationModel
      .aggregate<{ _id: QuotationStatus; count: number }>([
        { $match: notDeleted() },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();

    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  /** Counts per ISO week for the dashboard chart. */
  async countPerWeek(weeks: number): Promise<{ weekStart: string; count: number }[]> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - weeks * 7);
    since.setUTCHours(0, 0, 0, 0);

    const rows = await this.quotationModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { ...notDeleted(), createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                // Truncating to the week start in Mongo rather than in JS keeps
                // the bucketing consistent with the query's own date maths.
                date: { $dateTrunc: { date: '$createdAt', unit: 'week' } },
              },
            },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const counts = new Map(rows.map((row) => [row._id, row.count]));

    // Emit every week in the window, including empty ones — a gap would make
    // the trend look denser than it is.
    return Array.from({ length: weeks }, (_, index) => {
      const start = new Date(since);
      start.setUTCDate(start.getUTCDate() + index * 7);
      const key = start.toISOString().slice(0, 10);
      return { weekStart: start.toISOString(), count: counts.get(key) ?? 0 };
    });
  }

  async findRecent(limit: number): Promise<QuotationSummary[]> {
    const rows = await this.quotationModel
      .find(notDeleted())
      .select('quoteNumber createdAt customer items status')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return rows.map((row) => this.toSummary(row as unknown as QuotationRow));
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private buildFilter(query: QuotationListQueryDto): FilterQuery<QuotationDocument> {
    const filter: FilterQuery<QuotationDocument> = { ...notDeleted() };

    const statuses = toArray(query.status);
    if (statuses.length) filter.status = { $in: statuses };

    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = new Date(query.from);
      if (query.to) {
        // Inclusive of the whole end day — a picker returns midnight, and a
        // range "to today" that excludes today reads as a bug.
        const to = new Date(query.to);
        to.setUTCHours(23, 59, 59, 999);
        range.$lte = to;
      }
      filter.createdAt = range;
    }

    const term = query.q?.trim();
    if (term) {
      // Escaped before it reaches a RegExp: an unescaped '(' from the search
      // box would throw rather than return nothing.
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escaped, 'i');

      filter.$or = [
        { quoteNumber: pattern },
        { 'customer.company': pattern },
        { 'customer.name': pattern },
        { 'customer.email': pattern },
      ];
    }

    return filter;
  }

  private toSummary(row: QuotationRow): QuotationSummary {
    return {
      _id: String(row._id),
      quoteNumber: row.quoteNumber,
      createdAt: new Date(row.createdAt).toISOString(),
      company: row.customer.company,
      contactName: row.customer.name,
      email: row.customer.email,
      itemCount: row.items.reduce((total, item) => total + item.quantity, 0),
      status: row.status,
    };
  }

  private toDto(row: QuotationRow): QuotationDto {
    return {
      _id: String(row._id),
      quoteNumber: row.quoteNumber,
      customer: row.customer,
      address: row.address,
      items: row.items.map((item) => ({
        ...item,
        product: item.product ? String(item.product) : null,
      })),
      message: row.message,
      status: row.status,
      statusHistory: (row.statusHistory ?? []).map((entry) => ({
        ...entry,
        changedBy: String(entry.changedBy),
        changedAt: new Date(entry.changedAt).toISOString(),
      })),
      adminNotes: (row.adminNotes ?? []).map((entry) => ({
        ...entry,
        addedBy: String(entry.addedBy),
        addedAt: new Date(entry.addedAt).toISOString(),
      })),
      meta: row.meta,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }
}

/** The lean row shape — ObjectIds and Dates, before `toDto` stringifies them. */
type QuotationRow = Quotation & { _id: Types.ObjectId };

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}
