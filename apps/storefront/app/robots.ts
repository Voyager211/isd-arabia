import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site-config';

/**
 * PROJECT_PLAN.md §9.10.
 *
 * The three disallowed paths are the ones with no crawlable value: the cart
 * and request form are per-visitor state, and /search generates unbounded
 * near-duplicate URLs that dilute the catalogue's own pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/quote-cart', '/quote-request', '/search'],
      },
    ],
    sitemap: siteUrl('/sitemap.xml'),
    host: siteUrl(),
  };
}
