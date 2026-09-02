import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import type { AdminRole } from '@isd/shared-types';
import { ADMIN_ROLES } from '@isd/shared-types';

export type AdminUserDocument = HydratedDocument<AdminUser>;

/**
 * Admin accounts (PROJECT_PLAN.md §7.9).
 *
 * There is no public registration endpoint. The first account comes from the
 * seed script; further accounts are created by an existing super_admin.
 */
@Schema({ timestamps: true, collection: 'adminusers' })
export class AdminUser {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  /**
   * `select: false` is load-bearing, not tidiness. Without it a careless
   * `findOne()` that gets serialised into a response ships the hash to the
   * client. Reads that genuinely need it opt in with `.select('+passwordHash')`.
   */
  @Prop({ required: true, select: false })
  passwordHash: string;

  /** Hash of the current refresh token — rotation invalidates the old one. */
  @Prop({ type: String, select: false, default: null })
  refreshTokenHash: string | null;

  @Prop({ type: String, enum: ADMIN_ROLES, default: 'admin' })
  role: AdminRole;

  @Prop({ default: true })
  isActive: boolean;

  /**
   * Guardrail 2 of PROJECT_PLAN.md §12.1. The seeded account is created with
   * this true, and the guard blocks every admin route until it is cleared —
   * which is what makes shipping a documented default credential safe.
   */
  @Prop({ default: false })
  mustChangePassword: boolean;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  /**
   * Added at runtime by `timestamps: true`. Declared here so the type matches
   * what the collection actually holds — without it every read needs a cast to
   * reach createdAt/updatedAt, which is how casts start hiding real errors.
   */
  createdAt: Date;
  updatedAt: Date;
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);

/** Declared once here rather than via @Prop({ unique: true }), which would
 * create the same index twice and warn on every boot. */
AdminUserSchema.index({ email: 1 }, { unique: true });
