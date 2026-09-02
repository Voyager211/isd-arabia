/** Catalogue entities: category, brand, industry, product (PROJECT_PLAN.md §7). */

import type { AssetRef, BaseEntity, SeoMeta } from './common';

// ── Category ──────────────────────────────────────────────────────────────

/** Max depth 3. Level is derived by the service, never set by the client. */
export type CategoryLevel = 0 | 1 | 2;
export const MAX_CATEGORY_DEPTH = 3;

export interface Category extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  image?: AssetRef;
  banner?: AssetRef;
  parent: string | null;
  /** Denormalised path, root-first. Excludes self. */
  ancestors: string[];
  level: CategoryLevel;
  displayOrder: number;
  showInMenu: boolean;
  isActive: boolean;
  seo?: SeoMeta;
}

/** Category with its subtree attached — the shape of `GET /categories`. */
export interface CategoryNode extends Category {
  children: CategoryNode[];
  productCount?: number;
}

/** Trimmed shape for the mega-menu — `GET /categories/menu`. */
export interface MenuCategory {
  _id: string;
  name: string;
  slug: string;
  level: CategoryLevel;
  image?: Pick<AssetRef, 'url' | 'alt'>;
  children: MenuCategory[];
}

/** Breadcrumb trail returned alongside a single category. */
export interface BreadcrumbCrumb {
  name: string;
  slug: string;
}

// ── Brand ─────────────────────────────────────────────────────────────────

export interface Brand extends BaseEntity {
  name: string;
  slug: string;
  logo?: AssetRef;
  banner?: AssetRef;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  seo?: SeoMeta;
}

// ── Industry ──────────────────────────────────────────────────────────────

export interface Industry extends BaseEntity {
  name: string;
  slug: string;
  icon?: AssetRef;
  banner?: AssetRef;
  description?: string;
  /** Long-form sanitised HTML. */
  content?: string;
  displayOrder: number;
  isActive: boolean;
  seo?: SeoMeta;
}

// ── Product ───────────────────────────────────────────────────────────────

export const PRODUCT_AVAILABILITY = ['in_stock', 'made_to_order', 'on_request'] as const;
export type ProductAvailability = (typeof PRODUCT_AVAILABILITY)[number];

export const PRODUCT_UNITS = [
  'piece',
  'pack',
  'box',
  'roll',
  'metre',
  'kilogram',
  'litre',
  'set',
] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductDocument {
  name: string;
  url: string;
  publicId: string;
}

/**
 * NOTE: there is deliberately no price field. This is a quotation-only
 * platform — see CLAUDE.md §1. Do not add one "for later".
 */
export interface Product extends BaseEntity {
  name: string;
  slug: string;
  sku: string;
  shortDescription?: string;
  /** Sanitised rich text HTML. */
  description?: string;
  keyFeatures: string[];
  specifications: ProductSpecification[];

  /** Order 0 is the primary image. */
  images: AssetRef[];
  documents: ProductDocument[];

  /** Leaf category only. */
  category: string;
  /** category.ancestors + category._id — powers the descendant listing query. */
  categoryPath: string[];
  brand?: string | null;
  industries: string[];

  unit: ProductUnit;
  minOrderQuantity: number;
  availability: ProductAvailability;

  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  displayOrder: number;

  seo?: SeoMeta;
}

/** Product with its references resolved — what detail endpoints return. */
export interface ProductPopulated extends Omit<Product, 'category' | 'brand' | 'industries'> {
  category: Pick<Category, '_id' | 'name' | 'slug' | 'level'>;
  categoryTrail: BreadcrumbCrumb[];
  brand: Pick<Brand, '_id' | 'name' | 'slug' | 'logo'> | null;
  industries: Pick<Industry, '_id' | 'name' | 'slug'>[];
}

/** The trimmed shape a product card needs. */
export interface ProductCard {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription?: string;
  image: Pick<AssetRef, 'url' | 'alt'> | null;
  categoryName: string;
  categorySlug: string;
  brandName: string | null;
  unit: ProductUnit;
  minOrderQuantity: number;
  availability: ProductAvailability;
}

// ── Product listing query (PROJECT_PLAN.md §8.1) ───────────────────────────

export const PRODUCT_SORTS = ['newest', 'oldest', 'name_asc', 'name_desc', 'relevance'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_LIST_DEFAULT_LIMIT = 24;
export const PRODUCT_LIST_MAX_LIMIT = 60;

export interface ProductListQuery {
  category?: string | string[];
  brand?: string | string[];
  industry?: string | string[];
  q?: string;
  featured?: boolean;
  newArrival?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export interface SearchSuggestion {
  name: string;
  slug: string;
  sku: string;
  imageUrl: string | null;
  categoryName: string;
}
