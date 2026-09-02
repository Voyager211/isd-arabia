import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import type { ProductAvailability, ProductUnit } from '@isd/shared-types';
import { PRODUCT_AVAILABILITY, PRODUCT_UNITS } from '@isd/shared-types';
import {
  AssetRef,
  AssetRefSchema,
  SeoMeta,
  SeoMetaSchema,
  SOFT_DELETE_PROPS,
} from '@/database/schema.helpers';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ _id: false })
export class ProductSpecification {
  @Prop({ required: true, trim: true }) label: string;
  @Prop({ required: true, trim: true }) value: string;
}
export const ProductSpecificationSchema = SchemaFactory.createForClass(ProductSpecification);

@Schema({ _id: false })
export class ProductAttachment {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) publicId: string;
}
export const ProductAttachmentSchema = SchemaFactory.createForClass(ProductAttachment);

/**
 * PROJECT_PLAN.md §7.5.
 *
 * There is deliberately no price field, and none should be added "just in
 * case". This is a quote-only platform; an unused price field eventually leaks
 * into a response or a template on a site whose entire premise is
 * "price on request".
 */
@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ required: true, uppercase: true, trim: true })
  sku: string;

  @Prop({ trim: true, maxlength: 300 })
  shortDescription?: string;

  /** Sanitised rich text HTML — sanitised on write. */
  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  keyFeatures: string[];

  @Prop({ type: [ProductSpecificationSchema], default: [] })
  specifications: ProductSpecification[];

  /** Order 0 is the primary image, used on cards and as the OG fallback. */
  @Prop({ type: [AssetRefSchema], default: [] })
  images: AssetRef[];

  @Prop({ type: [ProductAttachmentSchema], default: [] })
  documents: ProductAttachment[];

  /** Leaf category only — enforced in the service, not the schema. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', required: true, index: true })
  category: Types.ObjectId;

  /**
   * category.ancestors + category._id.
   *
   * The denormalisation that makes a parent-category listing one indexed query.
   * It must be recomputed both when a product's category changes AND when that
   * category's own ancestors change — cover both paths or a re-parented
   * category silently drops its products out of the parent listing (§7.5).
   */
  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Category', default: [], index: true })
  categoryPath: Types.ObjectId[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Brand', default: null, index: true })
  brand: Types.ObjectId | null;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Industry', default: [], index: true })
  industries: Types.ObjectId[];

  @Prop({ type: String, enum: PRODUCT_UNITS, default: 'piece' })
  unit: ProductUnit;

  @Prop({ type: Number, default: 1, min: 1 })
  minOrderQuantity: number;

  @Prop({ type: String, enum: PRODUCT_AVAILABILITY, default: 'on_request' })
  availability: ProductAvailability;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: false })
  isNewArrival: boolean;

  @Prop({ type: Number, default: 0 })
  displayOrder: number;

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

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ sku: 1 }, { unique: true });

/** The main listing query. Field order matches equality-then-sort usage. */
ProductSchema.index({ categoryPath: 1, isActive: 1, isDeleted: 1 });
ProductSchema.index({ brand: 1, isActive: 1, isDeleted: 1 });
ProductSchema.index({ industries: 1, isActive: 1, isDeleted: 1 });
ProductSchema.index({ isFeatured: 1, isActive: 1, isDeleted: 1 });
ProductSchema.index({ isNewArrival: 1, isActive: 1, isDeleted: 1 });
ProductSchema.index({ createdAt: -1 });

/**
 * Text search. SKU is weighted high because industrial buyers search by part
 * number far more often than by description — someone typing "WP-26" wants
 * that torch, not every product whose blurb mentions it.
 */
ProductSchema.index(
  { name: 'text', sku: 'text', shortDescription: 'text' },
  { weights: { name: 10, sku: 8, shortDescription: 2 }, name: 'product_text_search' },
);
