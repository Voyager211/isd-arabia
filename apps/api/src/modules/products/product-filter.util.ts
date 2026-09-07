import { Types } from 'mongoose';

import type { ProductSort } from '@isd/shared-types';
import { PRODUCT_LIST_DEFAULT_LIMIT, PRODUCT_LIST_MAX_LIMIT } from '@isd/shared-types';

/**
 * Builds the Mongo filter and sort for a product listing.
 *
 * Pure and separate from the service so it can be tested without a database —
 * this is the query that every catalogue page runs, and a mistake here is
 * either a wrong result set or a collection scan on a shared-CPU tier.
 *
 * Nothing from the request reaches a filter untyped. Ids arrive as resolved
 * ObjectIds and everything else is a validated primitive, so a client cannot
 * smuggle an operator like `{ "$ne": null }` into the query
 * (PROJECT_PLAN.md §12.3).
 */

export interface ProductFilterInput {
  /** Already resolved from slugs by the service. */
  categoryIds?: Types.ObjectId[];
  brandIds?: Types.ObjectId[];
  industryIds?: Types.ObjectId[];
  search?: string;
  featured?: boolean;
  newArrival?: boolean;
  /** Admin listings include inactive and search across name and SKU. */
  includeInactive?: boolean;
}

/**
 * The three user-selectable dimensions, kept separate from the base filter.
 *
 * The listing aggregation needs them individually: each facet branch counts
 * with its OWN dimension left out, so ticking one brand still shows how many
 * products the other brands have.
 */
export interface DimensionFilters {
  category: { categoryPath: { $in: Types.ObjectId[] } } | null;
  brand: { brand: { $in: Types.ObjectId[] } } | null;
  industry: { industries: { $in: Types.ObjectId[] } } | null;
}

export function buildDimensionFilters(input: ProductFilterInput): DimensionFilters {
  return {
    /**
     * `categoryPath` rather than `category`: the path holds the category's
     * ancestors as well as itself, so filtering on a parent's id returns
     * everything beneath it in one indexed query instead of a recursive
     * lookup (PROJECT_PLAN.md §7.5).
     */
    category: input.categoryIds?.length ? { categoryPath: { $in: input.categoryIds } } : null,
    brand: input.brandIds?.length ? { brand: { $in: input.brandIds } } : null,
    industry: input.industryIds?.length ? { industries: { $in: input.industryIds } } : null,
  };
}

/** Combines the non-null fragments into a single `$match` filter. */
export function combineFilters(
  ...parts: (Record<string, unknown> | null | undefined)[]
): Record<string, unknown> {
  // A typed reduce rather than `Object.assign({}, ...spread)`, which widens
  // the result to `any` and silently disables checking downstream.
  return parts.reduce<Record<string, unknown>>(
    (combined, part) => (part ? { ...combined, ...part } : combined),
    {},
  );
}

export type ProductFilter = Record<string, unknown>;

export function buildProductFilter(input: ProductFilterInput): ProductFilter {
  const filter: ProductFilter = { isDeleted: false };

  if (!input.includeInactive) filter.isActive = true;

  /**
   * `categoryPath` rather than `category`: the path holds the category's
   * ancestors as well as itself, so filtering on a parent's id returns
   * everything beneath it in one indexed query instead of a recursive lookup
   * (PROJECT_PLAN.md §7.5).
   */
  if (input.categoryIds?.length) {
    filter.categoryPath = { $in: input.categoryIds };
  }

  if (input.brandIds?.length) {
    filter.brand = { $in: input.brandIds };
  }

  if (input.industryIds?.length) {
    filter.industries = { $in: input.industryIds };
  }

  if (input.featured !== undefined) filter.isFeatured = input.featured;
  if (input.newArrival !== undefined) filter.isNewArrival = input.newArrival;

  const search = input.search?.trim();
  if (search) {
    filter.$text = { $search: search };
  }

  return filter;
}

/**
 * `relevance` is only meaningful alongside a `$text` stage — Mongo has no
 * `textScore` to sort by otherwise, and asking for one on a non-text query is
 * an error. It therefore falls back to `newest`.
 */
export function buildProductSort(
  sort: ProductSort | undefined,
  hasTextSearch: boolean,
): Record<string, 1 | -1> {
  const effective: ProductSort = sort ?? (hasTextSearch ? 'relevance' : 'newest');

  switch (effective) {
    case 'relevance':
      /**
       * Sorts on a plain `score` field, not `{ $meta: 'textScore' }`.
       *
       * The service materialises the score with `$addFields` immediately after
       * the top-level `$match`, because `$text` metadata is not reachable from
       * inside a `$facet` sub-pipeline — which is where this sort runs.
       */
      return hasTextSearch ? { score: -1, createdAt: -1 } : { createdAt: -1 };
    case 'oldest':
      return { createdAt: 1 };
    case 'name_asc':
      return { name: 1 };
    case 'name_desc':
      return { name: -1 };
    case 'newest':
    default:
      // displayOrder first so an admin can pin products to the top of a
      // category without touching timestamps.
      return { displayOrder: 1, createdAt: -1 };
  }
}

export interface NormalisedPaging {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Clamps paging into a safe range.
 *
 * The upper bound on `limit` is the important one: without it a caller can ask
 * for 100,000 products in one request and exhaust the free-tier instance's
 * memory. Bad input is clamped rather than rejected — a malformed `?page=` in
 * a shared link should still render page 1, not a 400.
 */
export function normalisePaging(page?: number, limit?: number): NormalisedPaging {
  const safePage = Number.isFinite(page) && page! > 0 ? Math.floor(page!) : 1;

  const safeLimit =
    Number.isFinite(limit) && limit! > 0
      ? Math.min(Math.floor(limit!), PRODUCT_LIST_MAX_LIMIT)
      : PRODUCT_LIST_DEFAULT_LIMIT;

  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

/** Accepts `?brand=a&brand=b` and `?brand=a,b` alike. */
export function toSlugArray(value: string | string[] | undefined): string[] {
  if (!value) return [];

  const raw = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      raw
        .flatMap((entry) => entry.split(','))
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}
