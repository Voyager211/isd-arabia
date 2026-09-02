/**
 * Cache tags (PROJECT_PLAN.md §4.2).
 *
 * These strings MUST match `CacheTag` in apps/api/src/modules/revalidation/
 * revalidation.service.ts. A mismatch in either direction produces a cache
 * that never invalidates, and the symptom — "my edit did not save" — points
 * at the wrong layer entirely.
 */
export const tags = {
  productsList: 'products:list',
  product: (slug: string) => `product:${slug}`,
  categoriesMenu: 'categories:menu',
  categoriesTree: 'categories:tree',
  category: (slug: string) => `category:${slug}`,
  brandsList: 'brands:list',
  brand: (slug: string) => `brand:${slug}`,
  industriesList: 'industries:list',
  industry: (slug: string) => `industry:${slug}`,
  catalogue: 'catalogue:active',
  home: 'home',
} as const;
