/**
 * Cloudinary URL construction (PROJECT_PLAN.md §13.2).
 *
 * Transformed URLs are never stored — the database holds the publicId and the
 * base secure_url only, and the preset is applied here at render time. That
 * makes re-tuning image sizes a code change rather than a data migration.
 */

export const CLOUDINARY_PRESETS = {
  productCard: 'w_400,h_400,c_pad,b_white,q_auto,f_auto',
  productMain: 'w_800,h_800,c_pad,b_white,q_auto,f_auto',
  productThumb: 'w_120,h_120,c_pad,b_white,q_auto,f_auto',
  banner: 'w_1600,c_fill,q_auto,f_auto',
  catalogueCover: 'w_400,c_fit,q_auto,f_auto',
  brandLogo: 'w_240,h_120,c_pad,b_white,q_auto,f_auto',
  categoryTile: 'w_600,h_400,c_fill,q_auto,f_auto',
} as const;

export type CloudinaryPreset = keyof typeof CLOUDINARY_PRESETS;

/**
 * Injects a transformation into a Cloudinary delivery URL.
 *
 * Non-Cloudinary URLs pass through unchanged so a placeholder or a locally
 * hosted asset does not break the page.
 */
export function cloudinaryUrl(url: string, preset: CloudinaryPreset): string {
  if (!url.includes('/upload/')) return url;

  const transformation = CLOUDINARY_PRESETS[preset];
  return url.replace('/upload/', `/upload/${transformation}/`);
}

/** A neutral placeholder for products that have no image yet. */
export const PLACEHOLDER_IMAGE = '/images/product-placeholder.svg';
