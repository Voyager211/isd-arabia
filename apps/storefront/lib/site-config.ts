/**
 * Static site details.
 *
 * Placeholders until the client supplies the real contact block and social
 * handles — flagged for confirmation before staging.
 */

export const CONTACT = {
  phone: '+966 13 000 0000',
  whatsapp: '+966 50 000 0000',
  email: 'sales@isdarabia.com',
  address: {
    line1: 'Industrial Area, Second Industrial City',
    line2: 'Dammam 32233',
    country: 'Kingdom of Saudi Arabia',
  },
} as const;

export const SOCIAL = {
  linkedin: 'https://www.linkedin.com/',
} as const;

/** Absolute site URL — used for canonicals, OG tags and the sitemap. */
export function siteUrl(path = '/'): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return new URL(path, base).toString();
}

/** Top-level nav entries that are not category trees. */
export const STATIC_NAV = [
  { href: '/products', labelKey: 'allProducts' },
  { href: '/brands', labelKey: 'brands' },
  { href: '/industries', labelKey: 'industries' },
  { href: '/about', labelKey: 'about' },
  { href: '/contact', labelKey: 'contact' },
] as const;
