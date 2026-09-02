import type {
  Brand,
  CategoryNode,
  CataloguePublic,
  Industry,
  MenuCategory,
} from '@isd/shared-types';

import { apiGet, apiGetOrNull, Revalidate } from './server';
import { tags } from './tags';

/**
 * Typed catalogue reads.
 *
 * Every call lives here rather than inline in a page so the tag/revalidate
 * pairing for a given resource is decided once. A page that fetches directly
 * is the easiest way to end up with an untagged, unpurgeable response.
 */

/**
 * Mega-menu data. Fetched in the root layout so the whole category tree is in
 * the server HTML on every page — it is the catalogue's primary internal link
 * graph and needs to be crawlable.
 */
export function getMenu(): Promise<MenuCategory[]> {
  return apiGet<MenuCategory[]>('/categories/menu', {
    tags: [tags.categoriesMenu],
    revalidate: Revalidate.hour,
  });
}

export function getCategoryTree(): Promise<CategoryNode[]> {
  return apiGet<CategoryNode[]>('/categories', {
    tags: [tags.categoriesTree],
    revalidate: Revalidate.hour,
  });
}

export function getBrands(): Promise<Brand[]> {
  return apiGet<Brand[]>('/brands', {
    tags: [tags.brandsList],
    revalidate: Revalidate.hour,
    searchParams: { active: true },
  });
}

export function getIndustries(): Promise<Industry[]> {
  return apiGet<Industry[]>('/industries', {
    tags: [tags.industriesList],
    revalidate: Revalidate.hour,
  });
}

/**
 * The active catalogue's public metadata.
 *
 * Carries no file URL when the download is gated — the API withholds it, so
 * the storefront never has the asset address to leak.
 */
export function getActiveCatalogue(): Promise<CataloguePublic | null> {
  return apiGetOrNull<CataloguePublic>('/catalogue/active', {
    tags: [tags.catalogue],
    revalidate: Revalidate.hour,
  });
}
