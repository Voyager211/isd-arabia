import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '@/config/config.service';

/**
 * Cache tags the storefront fetches are tagged with (PROJECT_PLAN.md §4.2).
 *
 * Centralised so the tag a service purges and the tag a fetch registers cannot
 * drift apart — a typo in either direction produces a cache that silently
 * never invalidates, which reads as "the admin edit did not save".
 */
export const CacheTag = {
  productsList: 'products:list',
  product: (slug: string) => `product:${slug}`,
  categoriesMenu: 'categories:menu',
  categoriesTree: 'categories:tree',
  category: (slug: string) => `category:${slug}`,
  brandsList: 'brands:list',
  brand: (slug: string) => `brand:${slug}`,
  industriesList: 'industries:list',
  industry: (slug: string) => `industry:${slug}`,
  catalogue: 'catalogue:active',
  home: 'home',
} as const;

@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(private readonly config: AppConfigService) {}

  /**
   * Purges storefront cache tags. Fire-and-forget by design.
   *
   * Acceptance criterion #31: saving a product triggers revalidation, and a
   * failed revalidation does not fail the save. The admin's write has already
   * committed by the time this runs — the worst case is a stale page for up to
   * the route's own revalidate window, which is a far better outcome than
   * telling the admin their save failed when it did not.
   */
  revalidate(tags: string[]): void {
    if (!tags.length) return;

    void this.send(tags).catch((error: Error) => {
      this.logger.error(
        `Revalidation failed for tags [${tags.join(', ')}]: ${error.message}. ` +
          'The write succeeded; the storefront will refresh on its normal schedule.',
      );
    });
  }

  /** Awaitable variant, for the seed script and integration tests. */
  async send(tags: string[]): Promise<void> {
    const { url, secret } = this.config.revalidation;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`Storefront responded ${response.status} ${response.statusText}`);
    }

    this.logger.debug(`Revalidated tags: ${tags.join(', ')}`);
  }
}
