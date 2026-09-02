import { Injectable, Logger } from '@nestjs/common';

/**
 * A small in-process cache for the read-mostly taxonomy endpoints
 * (PROJECT_PLAN.md §15.1).
 *
 * The category tree and mega-menu are fetched on essentially every storefront
 * render and change a handful of times a week. Serving them from memory takes
 * the most frequent query in the system off a shared-CPU M0 entirely.
 *
 * Deliberately in-process rather than Redis: there is exactly one API instance
 * on the Render free tier, the payload is a few kilobytes, and adding a second
 * service to the infrastructure for this would cost more than it saves. If the
 * API is ever scaled horizontally this becomes a per-instance cache — still
 * correct, just less effective, and the TTL bounds the staleness either way.
 *
 * Writes invalidate explicitly, so the TTL is a backstop rather than the
 * primary freshness mechanism.
 */
@Injectable()
export class MemoryCacheService {
  private readonly logger = new Logger(MemoryCacheService.name);
  private readonly store = new Map<string, { value: unknown; expiresAt: number }>();

  /** Five minutes. Explicit invalidation is what actually keeps this fresh. */
  static readonly DEFAULT_TTL_MS = 5 * 60 * 1000;

  /**
   * Returns the cached value, or computes and stores it.
   *
   * A failed factory is never cached — otherwise a single API hiccup would be
   * served for the whole TTL.
   */
  async wrap<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs: number = MemoryCacheService.DEFAULT_TTL_MS,
  ): Promise<T> {
    const hit = this.store.get(key);

    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }

    const value = await factory();
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  /** Drops every key beginning with `prefix`. */
  invalidate(prefix: string): void {
    let dropped = 0;

    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        dropped += 1;
      }
    }

    if (dropped > 0) {
      this.logger.debug(
        `Invalidated ${dropped} cache entr${dropped === 1 ? 'y' : 'ies'} for '${prefix}'`,
      );
    }
  }

  clear(): void {
    this.store.clear();
  }
}
