/** Shared primitives and the API response envelope (PROJECT_PLAN.md §8). */

export type ISODateString = string;

/** Cloudinary asset reference (PROJECT_PLAN.md §7.1). */
export interface AssetRef {
  url: string;
  publicId: string;
  alt: string;
  width?: number;
  height?: number;
  order: number;
}

/** SEO metadata, embedded on every publicly addressable entity. */
export interface SeoMeta {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  ogImage?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FacetBucket {
  slug: string;
  name: string;
  count: number;
}

export interface ProductFacets {
  categories: FacetBucket[];
  brands: FacetBucket[];
  industries: FacetBucket[];
}

export interface ApiSuccess<TData, TMeta = Record<string, unknown>> {
  success: true;
  data: TData;
  meta?: TMeta;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiError {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export type ApiResponse<TData, TMeta = Record<string, unknown>> =
  ApiSuccess<TData, TMeta> | ApiError;

/** Soft-delete + timestamp fields present on every persisted entity. */
export interface BaseEntity {
  _id: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
