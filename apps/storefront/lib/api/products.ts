import type {
  Brand,
  BreadcrumbCrumb,
  Category,
  Industry,
  PaginationMeta,
  ProductCard,
  ProductFacets,
  ProductListQuery,
  ProductPopulated,
} from '@isd/shared-types';

import { apiFetch, apiGet, apiGetOrNull, Revalidate } from './server';
import { tags } from './tags';

/**
 * Typed catalogue reads for the listing and detail pages.
 *
 * Each function owns the tag/revalidate pairing for its resource, so a page
 * cannot accidentally fetch something untagged and unpurgeable.
 */

export interface ProductListMeta extends PaginationMeta {
  facets: ProductFacets;
}

export interface ProductListResult {
  products: ProductCard[];
  meta: ProductListMeta;
}

/** Turns the parsed query into the API's search parameters. */
function toSearchParams(
  query: ProductListQuery,
): Record<string, string | string[] | number | boolean | undefined> {
  return {
    category: query.category,
    brand: query.brand,
    industry: query.industry,
    q: query.q,
    featured: query.featured,
    newArrival: query.newArrival,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
  };
}

/**
 * A filtered listing.
 *
 * `extraTags` lets a category or brand page register its own tag, so an admin
 * editing that one category purges only its listing rather than every page in
 * the catalogue.
 */
export async function getProducts(
  query: ProductListQuery,
  extraTags: string[] = [],
): Promise<ProductListResult> {
  const { data, meta } = await apiFetch<ProductCard[], ProductListMeta>('/products', {
    tags: [tags.productsList, ...extraTags],
    revalidate: Revalidate.hour,
    searchParams: toSearchParams(query),
  });

  return {
    products: data,
    meta: meta ?? {
      page: 1,
      limit: 24,
      total: data.length,
      totalPages: 1,
      facets: { categories: [], brands: [], industries: [] },
    },
  };
}

export function getProduct(slug: string): Promise<ProductPopulated | null> {
  return apiGetOrNull<ProductPopulated>(`/products/${encodeURIComponent(slug)}`, {
    tags: [tags.product(slug)],
    // Detail pages revalidate daily; the on-demand purge is the real refresh
    // path, so a long window here costs nothing and saves API calls.
    revalidate: Revalidate.day,
  });
}

export function getRelatedProducts(slug: string): Promise<ProductCard[]> {
  return apiGet<ProductCard[]>(`/products/${encodeURIComponent(slug)}/related`, {
    tags: [tags.product(slug), tags.productsList],
    revalidate: Revalidate.day,
  });
}

export interface CategoryDetail {
  category: Category;
  breadcrumbs: BreadcrumbCrumb[];
  descendantIds: string[];
}

export function getCategory(slug: string): Promise<CategoryDetail | null> {
  return apiGetOrNull<CategoryDetail>(`/categories/${encodeURIComponent(slug)}`, {
    tags: [tags.category(slug), tags.categoriesTree],
    revalidate: Revalidate.hour,
  });
}

export function getBrand(slug: string): Promise<Brand | null> {
  return apiGetOrNull<Brand>(`/brands/${encodeURIComponent(slug)}`, {
    tags: [tags.brand(slug), tags.brandsList],
    revalidate: Revalidate.hour,
  });
}

export function getIndustry(slug: string): Promise<Industry | null> {
  return apiGetOrNull<Industry>(`/industries/${encodeURIComponent(slug)}`, {
    tags: [tags.industry(slug), tags.industriesList],
    revalidate: Revalidate.day,
  });
}

/** Slugs for `generateStaticParams` and the sitemap. */
export function getProductSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  return apiGet<{ slug: string; updatedAt: string }[]>('/products/slugs', {
    tags: [tags.productsList],
    revalidate: Revalidate.hour,
  });
}
