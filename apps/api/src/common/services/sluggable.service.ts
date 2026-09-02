import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';

import { toSlug } from '@/common/utils/slug.util';
import { notDeleted } from '@/database/schema.helpers';

/**
 * Shared behaviour for the flat, slug-addressed collections — brands and
 * industries.
 *
 * Categories deliberately do NOT extend this: their tree maintenance,
 * depth/cycle rules and cascading `ancestors` rebuild have nothing in common
 * with a flat list, and forcing them through a shared base would obscure the
 * part of the codebase most likely to hide a bug.
 *
 * Products do not either — their filter builder and facet aggregation are
 * substantial enough to own their service outright.
 */
export abstract class SluggableService<TDocument> {
  protected constructor(
    protected readonly model: Model<TDocument>,
    /** Used in error messages: 'Brand', 'Industry'. */
    protected readonly label: string,
  ) {}

  /**
   * Generates a unique slug, appending `-2`, `-3`, … on collision.
   *
   * Done here as well as by the unique index so the admin sees a usable
   * suggestion rather than a bare duplicate-key error.
   */
  protected async ensureUniqueSlug(source: string, excludeId?: string): Promise<string> {
    const base = toSlug(source);

    if (!base) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'The name must contain at least one letter or number.',
        details: [{ field: 'name', message: 'Cannot generate a URL from this name.' }],
      });
    }

    const taken = await this.model
      .find({
        slug: new RegExp(`^${base}(-\\d+)?$`),
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      })
      .select('slug')
      .lean<{ slug: string }[]>()
      .exec();

    const used = new Set(taken.map((entry) => entry.slug));
    if (!used.has(base)) return base;

    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  protected async findOrThrow(id: string): Promise<TDocument> {
    const document = await this.model.findOne({ _id: id, ...notDeleted() }).exec();
    if (!document) throw new NotFoundException(`${this.label} not found.`);
    return document;
  }
}
