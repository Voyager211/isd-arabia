import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import type { CategoryLevel } from '@isd/shared-types';

import {
  AssetRef,
  AssetRefSchema,
  SeoMeta,
  SeoMetaSchema,
  SOFT_DELETE_PROPS,
} from '@/database/schema.helpers';

export type CategoryDocument = HydratedDocument<Category>;

/** Three-level tree, levels 0–2 (PROJECT_PLAN.md §7.2). */
@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: AssetRefSchema })
  image?: AssetRef;

  @Prop({ type: AssetRefSchema })
  banner?: AssetRef;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', default: null, index: true })
  parent: Types.ObjectId | null;

  /**
   * Denormalised root-first path, excluding self.
   *
   * This is what makes "everything under Welding" a single indexed query
   * instead of a recursive lookup. The service maintains it on create and on
   * parent change — and when a parent moves, it rebuilds `ancestors` for every
   * descendant in one bulkWrite (§7.2).
   */
  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Category', default: [], index: true })
  ancestors: Types.ObjectId[];

  /**
   * Derived from `ancestors.length`. Never accepted from the client — a client
   * that could set this could file a category at depth 7.
   */
  @Prop({ type: Number, default: 0, min: 0, max: 2 })
  level: CategoryLevel;

  @Prop({ type: Number, default: 0 })
  displayOrder: number;

  @Prop({ default: true })
  showInMenu: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: SeoMetaSchema })
  seo?: SeoMeta;

  @Prop(SOFT_DELETE_PROPS.isDeleted)
  isDeleted: boolean;

  @Prop(SOFT_DELETE_PROPS.deletedAt)
  deletedAt: Date | null;

  /**
   * Added at runtime by `timestamps: true`. Declared here so the type matches
   * what the collection actually holds — without it every read needs a cast to
   * reach createdAt/updatedAt, which is how casts start hiding real errors.
   */
  createdAt: Date;
  updatedAt: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ parent: 1, displayOrder: 1 });
CategorySchema.index({ ancestors: 1 });
CategorySchema.index({ isActive: 1, isDeleted: 1 });
/** Serves the mega-menu query without touching the rest of the tree. */
CategorySchema.index({ showInMenu: 1, isActive: 1, isDeleted: 1, displayOrder: 1 });
