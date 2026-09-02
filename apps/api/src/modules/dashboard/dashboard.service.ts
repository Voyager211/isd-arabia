import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { DashboardStats, QuotationStatus } from '@isd/shared-types';
import { QUOTATION_STATUSES } from '@isd/shared-types';

import { notDeleted } from '@/database/schema.helpers';
import { Category, CategoryDocument } from '@/modules/categories/category.schema';
import { Product, ProductDocument } from '@/modules/products/product.schema';
import { QuotationService } from '@/modules/quotations/quotation.service';
import { CatalogueService } from '@/modules/catalogue/catalogue.service';

/**
 * Admin dashboard counts (PROJECT_PLAN.md §11.3).
 *
 * Every figure is a `countDocuments` or a small aggregation over an indexed
 * field, and they all run in parallel. This screen loads on every sign-in, so
 * it must not become the slowest page in the admin on a shared-CPU tier.
 *
 */
@Injectable()
export class DashboardService {
  private static readonly RECENT_QUOTATION_LIMIT = 10;
  private static readonly CHART_WEEKS = 8;

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    private readonly quotations: QuotationService,
    private readonly catalogue: CatalogueService,
  ) {}

  async getStats(): Promise<DashboardStats> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const [
      totalProducts,
      totalCategories,
      newQuotationsLast7Days,
      catalogueDownloadsLast30Days,
      byStatus,
      quotationsPerWeek,
      recentQuotations,
    ] = await Promise.all([
      this.productModel.countDocuments({ ...notDeleted(), isActive: true }).exec(),
      this.categoryModel.countDocuments({ ...notDeleted(), isActive: true }).exec(),
      this.quotations.countSince(sevenDaysAgo),
      this.catalogue.countLeadsSince(thirtyDaysAgo),
      this.quotations.countByStatus(),
      this.quotations.countPerWeek(DashboardService.CHART_WEEKS),
      this.quotations.findRecent(DashboardService.RECENT_QUOTATION_LIMIT),
    ]);

    return {
      totalProducts,
      totalCategories,
      newQuotationsLast7Days,
      catalogueDownloadsLast30Days,
      // Every status is present, including the ones with no rows — the
      // breakdown should read as a zero rather than a missing bar.
      quotationsByStatus: {
        ...emptyStatusCounts(),
        ...byStatus,
      } as Record<QuotationStatus, number>,
      quotationsPerWeek,
      recentQuotations,
    };
  }
}

function emptyStatusCounts(): Record<QuotationStatus, number> {
  return Object.fromEntries(QUOTATION_STATUSES.map((status) => [status, 0])) as Record<
    QuotationStatus,
    number
  >;
}
