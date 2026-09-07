import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildMetadata } from './seo';

describe('buildMetadata', () => {
  it('always emits a canonical', () => {
    const meta = buildMetadata({ fallbackTitle: 'Test', path: '/test' });
    expect(meta.alternates?.canonical).toContain('/test');
  });

  it('prefers the admin-authored SEO fields over the fallbacks', () => {
    const meta = buildMetadata({
      seo: { metaTitle: 'Authored title', metaDescription: 'Authored description' },
      fallbackTitle: 'Fallback title',
      fallbackDescription: 'Fallback description',
      path: '/test',
    });

    expect(meta.title).toBe('Authored title');
    expect(meta.description).toBe('Authored description');
  });

  it('falls back when the SEO fields are blank', () => {
    const meta = buildMetadata({
      seo: { metaTitle: '', metaDescription: '' },
      fallbackTitle: 'Fallback title',
      path: '/test',
    });

    expect(meta.title).toBe('Fallback title');
  });

  it('truncates to what search engines actually render', () => {
    const meta = buildMetadata({
      fallbackTitle: 'x'.repeat(120),
      fallbackDescription: 'y'.repeat(400),
      path: '/test',
    });

    expect(String(meta.title).length).toBeLessThanOrEqual(60);
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
  });

  it('marks a page noindex on request but keeps it followable', () => {
    // The cart and request pages have no crawl value themselves, but the links
    // out of them still should be followed.
    const meta = buildMetadata({ fallbackTitle: 'Cart', path: '/quote-cart', noindex: true });

    expect(meta.robots).toMatchObject({ index: false, follow: true });
  });

  it('can bypass the layout title template', () => {
    const meta = buildMetadata({ fallbackTitle: 'Home', path: '/', absoluteTitle: true });
    expect(meta.title).toEqual({ absolute: 'Home' });
  });
});

/**
 * Acceptance criterion #12 requires a canonical on EVERY page.
 *
 * The bug this guards against was not a broken `buildMetadata` — it was a page
 * that never called it. `app/page.tsx` inherited the layout's metadata, which
 * sets no `alternates`, so the highest-traffic page on the site was the one
 * without a canonical. No unit test of the helper could have caught that.
 *
 * So this walks the route tree instead and asserts each page declares its own
 * metadata. It is a structural check, not a behavioural one, which is exactly
 * what the failure mode called for.
 */
describe('every indexable route declares its own metadata', () => {
  const appDir = join(__dirname, '..', 'app');

  /** Route files, excluding API handlers and non-page modules. */
  function findPages(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);

      if (statSync(path).isDirectory()) {
        // Route handlers are not pages and carry no metadata.
        if (entry === 'api') continue;
        findPages(path, found);
      } else if (entry === 'page.tsx') {
        found.push(path);
      }
    }

    return found;
  }

  const pages = findPages(appDir);

  it('finds the route tree', () => {
    // A guard on the guard: if the glob silently matched nothing, every
    // assertion below would vacuously pass.
    expect(pages.length).toBeGreaterThanOrEqual(9);
  });

  it.each(pages.map((path) => [path.slice(appDir.length).replace(/\\/g, '/'), path]))(
    '%s',
    (_label, path) => {
      const source = readFileSync(path, 'utf8');

      const declaresMetadata =
        /export const metadata\s*[:=]/.test(source) ||
        /export async function generateMetadata/.test(source);

      expect(declaresMetadata).toBe(true);
    },
  );
});
