import slugify from 'slugify';

/**
 * Canonical slug generation. Used by every entity that is publicly
 * addressable, so the rule lives in exactly one place.
 *
 * Slugs are generated from the name on create and are then editable by the
 * admin — an existing slug is never silently regenerated on rename, because
 * that would break indexed URLs.
 */
export function toSlug(input: string): string {
  return slugify(input, {
    lower: true,
    strict: true,
    trim: true,
    remove: /[*+~.()'"!:@]/g,
  });
}

/** Appends `-2`, `-3`, … until the candidate is not in `taken`. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const slug = toSlug(base);
  if (!taken.has(slug)) return slug;

  let suffix = 2;
  while (taken.has(`${slug}-${suffix}`)) suffix += 1;
  return `${slug}-${suffix}`;
}
