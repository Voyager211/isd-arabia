import type { ProductListQuery, ProductSort } from '@isd/shared-types';
import { PRODUCT_LIST_DEFAULT_LIMIT, PRODUCT_SORTS } from '@isd/shared-types';

/**
 * Parses a Next.js `searchParams` object into a typed listing query.
 *
 * Query strings are attacker-controlled and arrive as
 * `string | string[] | undefined`. Everything is validated here, once, so no
 * page has to think about it — an unknown `sort` becomes undefined rather than
 * reaching the API and producing a 400 on a link someone shared.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toPositiveInt(value: string | string[] | undefined, fallback: number): number {
  const parsed = Number.parseInt(first(value) ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface ParsedListingParams extends ProductListQuery {
  page: number;
  limit: number;
}

export function parseListingParams(
  searchParams: RawSearchParams,
  overrides: Partial<ProductListQuery> = {},
): ParsedListingParams {
  const sortCandidate = first(searchParams.sort);
  const sort = PRODUCT_SORTS.includes(sortCandidate as ProductSort)
    ? (sortCandidate as ProductSort)
    : undefined;

  return {
    category: searchParams.category,
    brand: searchParams.brand,
    industry: searchParams.industry,
    q: first(searchParams.q)?.slice(0, 200),
    sort,
    page: toPositiveInt(searchParams.page, 1),
    limit: PRODUCT_LIST_DEFAULT_LIMIT,
    ...overrides,
  };
}

/**
 * True when the visitor has narrowed or re-sorted a listing.
 *
 * Used to decide the canonical URL: only the clean listing URL is indexed, and
 * every filtered variant points its canonical back at it (PROJECT_PLAN.md
 * §4.1, §9.10). Without this, one category generates hundreds of near-duplicate
 * indexable URLs that compete with each other.
 */
export function isFilteredView(searchParams: RawSearchParams): boolean {
  return ['brand', 'industry', 'category', 'sort', 'page'].some(
    (key) => searchParams[key] !== undefined,
  );
}
