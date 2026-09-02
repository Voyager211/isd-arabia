import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

/**
 * Sub-schemas shared across entities (PROJECT_PLAN.md §7.1) and the
 * conventions every collection follows.
 */

/** Cloudinary asset reference. `publicId` is required — deletion needs it. */
@Schema({ _id: false })
export class AssetRef {
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) publicId: string;
  /** Required on images: the admin uploader will not submit without it. */
  @Prop({ required: true, default: '' }) alt: string;
  @Prop() width?: number;
  @Prop() height?: number;
  @Prop({ default: 0 }) order: number;
}
export const AssetRefSchema = SchemaFactory.createForClass(AssetRef);

/** Embedded SEO metadata — not a collection. */
@Schema({ _id: false })
export class SeoMeta {
  @Prop({ maxlength: 60 }) metaTitle?: string;
  @Prop({ maxlength: 160 }) metaDescription?: string;
  @Prop({ type: [String], default: [] }) metaKeywords: string[];
  @Prop() ogImage?: string;
}
export const SeoMetaSchema = SchemaFactory.createForClass(SeoMeta);

/** Request provenance stored on quotations and catalogue leads. */
@Schema({ _id: false })
export class RequestMetaSub {
  @Prop() userAgent?: string;
  @Prop() ipAddress?: string;
  @Prop() referrer?: string;
}
export const RequestMetaSubSchema = SchemaFactory.createForClass(RequestMetaSub);

/**
 * Soft-delete fields. Every collection carries them and every public query
 * filters `isDeleted: false` — see `notDeleted()`.
 */
export interface SoftDeletable {
  isDeleted: boolean;
  deletedAt?: Date | null;
}

export const SOFT_DELETE_PROPS = {
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
} as const;

/**
 * The filter fragment every public read starts from. Spread it rather than
 * typing the pair by hand — a query that forgets it silently serves deleted
 * records.
 */
export function notDeleted(): { isDeleted: false } {
  return { isDeleted: false };
}

export function activeAndNotDeleted(): { isActive: true; isDeleted: false } {
  return { isActive: true, isDeleted: false };
}

export type ObjectIdRef = MongooseSchema.Types.ObjectId;

/** Base document type: Mongoose adds these to every schema with timestamps. */
export interface TimestampedDocument extends Document {
  createdAt: Date;
  updatedAt: Date;
}
