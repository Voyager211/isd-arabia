import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import type { ProductUnit, QuotationStatus } from '@isd/shared-types';
import { PRODUCT_UNITS, QUOTATION_STATUSES } from '@isd/shared-types';

import { RequestMetaSub, RequestMetaSubSchema, SOFT_DELETE_PROPS } from '@/database/schema.helpers';

export type QuotationDocument = HydratedDocument<Quotation>;

/**
 * A submitted line (PROJECT_PLAN.md §7.6).
 *
 * Snapshotting is mandatory, not an optimisation. A quotation from six months
 * ago must render exactly as it was submitted even after the product is
 * renamed, re-categorised or deleted — so `name`, `sku`, `imageUrl` and `unit`
 * are copied at submission and never populated on read. The `product` ref is
 * kept only as a pointer for admins who want to open the live record; it is
 * nullable because the product may be gone.
 */
@Schema({ _id: false })
export class QuotationItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', default: null })
  product: Types.ObjectId | null;

  @Prop({ required: true }) name: string;
  @Prop({ required: true }) sku: string;
  @Prop({ default: '' }) imageUrl: string;

  @Prop({ type: String, enum: PRODUCT_UNITS, default: 'piece' })
  unit: ProductUnit;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ trim: true })
  note?: string;
}
export const QuotationItemSchema = SchemaFactory.createForClass(QuotationItem);

@Schema({ _id: false })
export class QuotationCustomer {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true, trim: true }) phone: string;
  @Prop({ required: true, trim: true }) company: string;
  @Prop({ trim: true }) designation?: string;
}
export const QuotationCustomerSchema = SchemaFactory.createForClass(QuotationCustomer);

@Schema({ _id: false })
export class QuotationAddress {
  @Prop({ required: true, trim: true }) line1: string;
  @Prop({ trim: true }) line2?: string;
  @Prop({ required: true, trim: true }) city: string;
  @Prop({ required: true, trim: true }) region: string;
  @Prop({ trim: true }) postalCode?: string;
  @Prop({ default: 'Saudi Arabia', trim: true }) country: string;
}
export const QuotationAddressSchema = SchemaFactory.createForClass(QuotationAddress);

/** An audit entry: who moved the quotation to which state, and when. */
@Schema({ _id: false })
export class QuotationStatusChange {
  @Prop({ type: String, enum: QUOTATION_STATUSES, required: true }) from: QuotationStatus;
  @Prop({ type: String, enum: QUOTATION_STATUSES, required: true }) to: QuotationStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AdminUser', required: true })
  changedBy: Types.ObjectId;

  /** Snapshotted so history stays readable if the admin account is removed. */
  @Prop({ trim: true }) changedByName?: string;
  @Prop({ trim: true }) note?: string;
  @Prop({ type: Date, default: Date.now }) changedAt: Date;
}
export const QuotationStatusChangeSchema = SchemaFactory.createForClass(QuotationStatusChange);

@Schema({ _id: false })
export class QuotationNote {
  @Prop({ required: true, trim: true }) note: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AdminUser', required: true })
  addedBy: Types.ObjectId;

  @Prop({ trim: true }) addedByName?: string;
  @Prop({ type: Date, default: Date.now }) addedAt: Date;
}
export const QuotationNoteSchema = SchemaFactory.createForClass(QuotationNote);

@Schema({ timestamps: true, collection: 'quotations' })
export class Quotation {
  /** QT-2026-0001 — allocated atomically from the Counter collection. */
  @Prop({ required: true, trim: true })
  quoteNumber: string;

  @Prop({ type: QuotationCustomerSchema, required: true })
  customer: QuotationCustomer;

  @Prop({ type: QuotationAddressSchema, required: true })
  address: QuotationAddress;

  @Prop({ type: [QuotationItemSchema], required: true })
  items: QuotationItem[];

  @Prop({ trim: true })
  message?: string;

  @Prop({ type: String, enum: QUOTATION_STATUSES, default: 'new', index: true })
  status: QuotationStatus;

  @Prop({ type: [QuotationStatusChangeSchema], default: [] })
  statusHistory: QuotationStatusChange[];

  @Prop({ type: [QuotationNoteSchema], default: [] })
  adminNotes: QuotationNote[];

  @Prop({ type: RequestMetaSubSchema })
  meta?: RequestMetaSub;

  @Prop(SOFT_DELETE_PROPS.isDeleted)
  isDeleted: boolean;

  @Prop(SOFT_DELETE_PROPS.deletedAt)
  deletedAt: Date | null;

  /**
   * Added at runtime by `timestamps: true`. Declared here so the type matches
   * what the collection actually holds.
   */
  createdAt: Date;
  updatedAt: Date;
}

export const QuotationSchema = SchemaFactory.createForClass(Quotation);

QuotationSchema.index({ quoteNumber: 1 }, { unique: true });
/** The admin table's default view: newest first, filtered by status. */
QuotationSchema.index({ status: 1, createdAt: -1 });
QuotationSchema.index({ 'customer.email': 1 });
QuotationSchema.index({ createdAt: -1 });
