import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { DashboardStats, QuotationStatus, QuotationSummary } from '@isd/shared-types';
import { QUOTATION_STATUSES } from '@isd/shared-types';

import { notDeleted } from '@/database/schema.helpers';
import { Category, CategoryDocument } from '@/modules/categories/category.schema';
import { Product, ProductDocument } from '@/modules/products/product.schema';

/**
 * Admin dashboard counts (PROJECT_PLAN.md §11.3).
 *
 * Every figure is a `countDocuments` or a small aggregation over an indexed
 * field, run in parallel. This screen loads on every sign-in, so it must not
 * become the slowest page in the admin on a shared-CPU tier.
 *
 * The quotation-derived figures return zeroes until the quotations collection
 * exists (Phase 3); the shape is already correct so the admin renders now and
 * needs no change when the data arrives.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const [totalProducts, totalCategories] = await Promise.all([
      this.productModel.countDocuments({ ...notDeleted(), isActive: true }).exec(),
      this.categoryModel.countDocuments({ ...notDeleted(), isActive: true }).exec(),
    ]);

    return {
      totalProducts,
      totalCategories,
      newQuotationsLast7Days: 0,
      catalogueDownloadsLast30Days: 0,
      quotationsByStatus: emptyStatusCounts(),
      quotationsPerWeek: lastEightWeeks(),
      recentQuotations: [] as QuotationSummary[],
    };
  }
}

function emptyStatusCounts(): Record<QuotationStatus, number> {
  return Object.fromEntries(QUOTATION_STATUSES.map((status) => [status, 0])) as Record<
    QuotationStatus,
    number
  >;
}

/**
 * Eight week-start dates, oldest first.
 *
 * Generated rather than derived from the data so the chart always has eight
 * bars — a week with no quotations should read as a zero, not as a gap that
 * makes the trend look denser than it is.
 */
function lastEightWeeks(): { weekStart: string; count: number }[] {
  const weeks: { weekStart: string; count: number }[] = [];
  const now = new Date();

  for (let offset = 7; offset >= 0; offset -= 1) {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - offset * 7);
    start.setUTCHours(0, 0, 0, 0);
    weeks.push({ weekStart: start.toISOString(), count: 0 });
  }

  return weeks;
}
