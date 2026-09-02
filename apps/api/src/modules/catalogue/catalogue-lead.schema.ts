import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { RequestMetaSub, RequestMetaSubSchema, SOFT_DELETE_PROPS } from '@/database/schema.helpers';

export type CatalogueLeadDocument = HydratedDocument<CatalogueLead>;

/**
 * A captured download lead (PROJECT_PLAN.md §7.8).
 *
 * The commercial reason the PDF is gated at all: the file is the bait, this
 * record is the catch.
 */
@Schema({ timestamps: true, collection: 'catalogueleads' })
export class CatalogueLead {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true, trim: true }) phone: string;
  @Prop({ required: true, trim: true }) company: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'CatalogueFile', required: true })
  catalogue: Types.ObjectId;

  /** Snapshotted so the leads table still reads correctly if the file is replaced. */
  @Prop({ trim: true })
  catalogueTitle?: string;

  @Prop({ type: RequestMetaSubSchema })
  meta?: RequestMetaSub;

  @Prop(SOFT_DELETE_PROPS.isDeleted)
  isDeleted: boolean;

  @Prop(SOFT_DELETE_PROPS.deletedAt)
  deletedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const CatalogueLeadSchema = SchemaFactory.createForClass(CatalogueLead);

CatalogueLeadSchema.index({ createdAt: -1 });
CatalogueLeadSchema.index({ email: 1 });
