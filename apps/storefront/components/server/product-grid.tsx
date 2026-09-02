import Link from 'next/link';

import type { ProductCard as ProductCardData } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { ProductCard } from './product-card';

/**
 * The product grid: 4 columns at xl, 3 at lg, 2 at sm and md
 * (PROJECT_PLAN.md §9.3).
 *
 * `priority` is set on the first four cards only. Marking every image priority
 * would make none of them a priority and regress LCP rather than improve it.
 */
export function ProductGrid({ products }: { products: ProductCardData[] }) {
  if (!products.length) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border-subtle p-12 text-center">
        <p className="font-display text-h3 font-semibold text-surface-inverse">{t.listing.empty}</p>
        <p className="mx-auto mt-2 max-w-[42ch] text-body-sm text-text-secondary">
          {t.listing.emptyHint}
        </p>
        <Link href="/products" className="btn-secondary mt-4">
          {t.nav.allProducts}
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <li key={product._id}>
          <ProductCard product={product} priority={index < 4} />
        </li>
      ))}
    </ul>
  );
}
