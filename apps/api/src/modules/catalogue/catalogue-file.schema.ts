import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { AssetRef, AssetRefSchema, SOFT_DELETE_PROPS } from '@/database/schema.helpers';

export type CatalogueFileDocument = HydratedDocument<CatalogueFile>;

/** The uploaded PDF itself — a Cloudinary `raw`, `authenticated` resource. */
@Schema({ _id: false })
export class CatalogueAsset {
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) publicId: string;
  @Prop({ required: true }) sizeBytes: number;
  @Prop() pageCount?: number;
}
export const CatalogueAssetSchema = SchemaFactory.createForClass(CatalogueAsset);

/** PROJECT_PLAN.md §7.7 */
@Schema({ timestamps: true, collection: 'cataloguefiles' })
export class CatalogueFile {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: CatalogueAssetSchema, required: true })
  file: CatalogueAsset;

  @Prop({ type: AssetRefSchema })
  coverImage?: AssetRef;

  @Prop({ required: true, trim: true })
  version: string;

  /**
   * When false the storefront links straight to the file with no modal. The
   * lead form is the point of the feature, so this defaults to true.
   */
  @Prop({ default: true })
  requiresLead: boolean;

  @Prop({ type: Number, default: 0 })
  downloadCount: number;

  /**
   * Exactly one file may be active. Enforced by the service, in a transaction,
   * so there is never a window with zero or two (§7.7, §14.1).
   */
  @Prop({ default: false, index: true })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  displayOrder: number;

  @Prop(SOFT_DELETE_PROPS.isDeleted)
  isDeleted: boolean;

  @Prop(SOFT_DELETE_PROPS.deletedAt)
  deletedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const CatalogueFileSchema = SchemaFactory.createForClass(CatalogueFile);

CatalogueFileSchema.index({ isActive: 1, isDeleted: 1 });
