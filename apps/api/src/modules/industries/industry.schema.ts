import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import {
  AssetRef,
  AssetRefSchema,
  SeoMeta,
  SeoMetaSchema,
  SOFT_DELETE_PROPS,
} from '@/database/schema.helpers';

export type IndustryDocument = HydratedDocument<Industry>;

/** PROJECT_PLAN.md §7.4 */
@Schema({ timestamps: true, collection: 'industries' })
export class Industry {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  slug: string;

  @Prop({ type: AssetRefSchema })
  icon?: AssetRef;

  @Prop({ type: AssetRefSchema })
  banner?: AssetRef;

  @Prop({ trim: true })
  description?: string;

  /** Long-form HTML. Sanitised on write, never on read. */
  @Prop()
  content?: string;

  @Prop({ type: Number, default: 0 })
  displayOrder: number;

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

export const IndustrySchema = SchemaFactory.createForClass(Industry);

IndustrySchema.index({ slug: 1 }, { unique: true });
IndustrySchema.index({ isActive: 1, isDeleted: 1, displayOrder: 1 });
