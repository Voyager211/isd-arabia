/** Quotation, cart, catalogue-download and admin types (PROJECT_PLAN.md §7.6–7.9, §10). */

import type { BaseEntity, ISODateString } from './common';
import type { ProductUnit } from './catalogue';

// ── Saudi regions ─────────────────────────────────────────────────────────

export const SAUDI_REGIONS = [
  'Riyadh',
  'Makkah',
  'Madinah',
  'Eastern Province',
  'Asir',
  'Tabuk',
  'Hail',
  'Northern Borders',
  'Jazan',
  'Najran',
  'Al Bahah',
  'Al Jawf',
  'Qassim',
] as const;
export type SaudiRegion = (typeof SAUDI_REGIONS)[number];

// ── Quotation ─────────────────────────────────────────────────────────────

export const QUOTATION_STATUSES = [
  'new',
  'in_review',
  'quoted',
  'won',
  'lost',
  'cancelled',
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

/** new → in_review → quoted → won | lost. `cancelled` is reachable from any state. */
export const QUOTATION_STATUS_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  new: ['in_review', 'quoted', 'cancelled'],
  in_review: ['quoted', 'won', 'lost', 'cancelled'],
  quoted: ['won', 'lost', 'cancelled'],
  won: ['cancelled'],
  lost: ['cancelled'],
  cancelled: [],
};

export interface QuotationCustomer {
  name: string;
  email: string;
  phone: string;
  company: string;
  designation?: string;
}

export interface QuotationAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode?: string;
  country: string;
}

/**
 * Line items snapshot name, sku, imageUrl and unit at submission time.
 * A quotation from six months ago must render exactly as submitted even after
 * the product is renamed or deleted — never populate for historical display.
 */
export interface QuotationItem {
  product: string | null;
  name: string;
  sku: string;
  imageUrl: string;
  unit: ProductUnit;
  quantity: number;
  note?: string;
}

export interface QuotationStatusChange {
  from: QuotationStatus;
  to: QuotationStatus;
  changedBy: string;
  changedByName?: string;
  note?: string;
  changedAt: ISODateString;
}

export interface QuotationNote {
  note: string;
  addedBy: string;
  addedByName?: string;
  addedAt: ISODateString;
}

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
}

export interface Quotation extends BaseEntity {
  /** QT-2026-0001 — allocated atomically from the Counter collection. */
  quoteNumber: string;
  customer: QuotationCustomer;
  address: QuotationAddress;
  items: QuotationItem[];
  message?: string;
  status: QuotationStatus;
  statusHistory: QuotationStatusChange[];
  adminNotes: QuotationNote[];
  meta?: RequestMeta;
}

/** Row shape for the admin quotations table. */
export interface QuotationSummary {
  _id: string;
  quoteNumber: string;
  createdAt: ISODateString;
  company: string;
  contactName: string;
  email: string;
  itemCount: number;
  status: QuotationStatus;
}

// ── Quotation submission (POST /quotations) ───────────────────────────────

export interface SubmitQuotationItem {
  productId: string;
  quantity: number;
  note?: string;
}

export interface SubmitQuotationRequest {
  customer: QuotationCustomer;
  address: QuotationAddress;
  items: SubmitQuotationItem[];
  message?: string;
  turnstileToken: string;
  /** Honeypot — must be empty. Named innocuously on purpose. */
  website?: string;
}

export interface SubmitQuotationResponse {
  quoteNumber: string;
  submittedAt: ISODateString;
  itemCount: number;
}

/**
 * 422 payload when a line references a product that has been deleted or
 * deactivated since it was added to the cart. The frontend highlights those
 * lines and offers to remove them, so the rest of the cart survives.
 */
export interface QuotationItemRejection {
  index: number;
  productId: string;
  reason: 'not_found' | 'inactive' | 'deleted';
}

// ── Client-side quotation cart (PROJECT_PLAN.md §10) ──────────────────────

export const CART_STORAGE_KEY = 'hox.quotecart.v1';
/** Discard a persisted cart older than this on hydrate. */
export const CART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  imageUrl: string;
  unit: ProductUnit;
  quantity: number;
  note?: string;
}

export interface CartState {
  items: CartItem[];
  updatedAt: number;
}

// ── Catalogue file and leads (PROJECT_PLAN.md §7.7–7.8) ───────────────────

export interface CatalogueFileAsset {
  url: string;
  publicId: string;
  sizeBytes: number;
  pageCount?: number;
}

export interface CatalogueFile extends BaseEntity {
  title: string;
  description?: string;
  file: CatalogueFileAsset;
  coverImage?: { url: string; publicId: string; alt: string };
  version: string;
  /** When false the download button links straight to the file, no modal. */
  requiresLead: boolean;
  downloadCount: number;
  /** Exactly one CatalogueFile may be active at a time. */
  isActive: boolean;
  displayOrder: number;
}

/** Public metadata for the download card — deliberately carries no file URL. */
export interface CataloguePublic {
  _id: string;
  title: string;
  description?: string;
  version: string;
  sizeBytes: number;
  pageCount?: number;
  coverImage?: { url: string; alt: string };
  requiresLead: boolean;
  /** Present only when requiresLead is false. */
  downloadUrl?: string;
}

export interface CatalogueDownloadRequest {
  name: string;
  email: string;
  phone: string;
  company: string;
  consent: boolean;
  turnstileToken: string;
  website?: string;
}

export interface CatalogueDownloadResponse {
  /** Cloudinary signed delivery URL, short expiry. */
  downloadUrl: string;
  expiresAt: ISODateString;
}

export interface CatalogueLead extends BaseEntity {
  name: string;
  email: string;
  phone: string;
  company: string;
  catalogue: string;
  catalogueTitle?: string;
  meta?: RequestMeta;
}

// ── Admin auth (PROJECT_PLAN.md §7.9, §12) ────────────────────────────────

export const ADMIN_ROLES = ['super_admin', 'admin'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AdminUser extends BaseEntity {
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: ISODateString;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Tokens are delivered as httpOnly cookies, never in this body.
 * `mustChangePassword` drives the forced password-change redirect.
 */
export interface LoginResponse {
  user: AdminUser;
  mustChangePassword: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** PROJECT_PLAN.md §12.1 — enforced on the server, mirrored in the client Zod schema. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a digit and a symbol.';

// ── Admin dashboard ───────────────────────────────────────────────────────

export interface DashboardStats {
  totalProducts: number;
  totalCategories: number;
  newQuotationsLast7Days: number;
  catalogueDownloadsLast30Days: number;
  quotationsByStatus: Record<QuotationStatus, number>;
  quotationsPerWeek: { weekStart: ISODateString; count: number }[];
  recentQuotations: QuotationSummary[];
}

// ── Uploads (PROJECT_PLAN.md §13.1) ───────────────────────────────────────

export type UploadFolder =
  'products' | 'categories' | 'brands' | 'industries' | 'banners' | 'catalogue';

export interface UploadSignatureRequest {
  folder: UploadFolder;
  resourceType: 'image' | 'raw';
  /** Scopes product images to /products/<productId>/. */
  productId?: string;
}

export interface UploadSignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  resourceType: 'image' | 'raw';
  uploadUrl: string;
}
