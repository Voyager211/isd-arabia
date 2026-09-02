import Image from 'next/image';
import Link from 'next/link';

import type { ProductCard as ProductCardData } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { cloudinaryUrl, PLACEHOLDER_IMAGE } from '@/lib/cloudinary';
import { AddToQuoteButton } from '@/components/client/add-to-quote-button';

/**
 * Product card (PROJECT_PLAN.md §9.3).
 *
 * A SERVER component. Only the "Add to quote" button is a client leaf, so a
 * grid of 24 cards ships one small interactive component per card rather than
 * hydrating the whole grid.
 *
 * There is no price here, and there is nowhere for one to go.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardData;
  /** Set on the first row only — the LCP image (PROJECT_PLAN.md §9.10). */
  priority?: boolean;
}) {
  const imageUrl = product.image
    ? cloudinaryUrl(product.image.url, 'productCard')
    : PLACEHOLDER_IMAGE;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border-subtle bg-surface-page shadow-resting transition-colors hover:border-action-secondary">
      <Link
        href={`/products/${product.slug}`}
        className="block overflow-hidden bg-white"
        tabIndex={-1}
        aria-hidden
      >
        <Image
          src={imageUrl}
          alt=""
          width={400}
          height={400}
          priority={priority}
          sizes="(min-width: 1280px) 300px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          className="aspect-square w-full object-contain transition-transform duration-300 motion-safe:group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {product.categoryName ? (
          <p className="text-caption text-text-secondary">{product.categoryName}</p>
        ) : null}

        <h3 className="mt-1">
          <Link
            href={`/products/${product.slug}`}
            className="line-clamp-2 font-display text-h3 leading-tight font-semibold text-surface-inverse hover:text-action-secondary"
          >
            {/* The image link above is aria-hidden, so this is the single
                accessible link to the product. */}
            {product.name}
          </Link>
        </h3>

        <p className="mt-1 text-caption text-text-secondary" data-tabular>
          {t.product.sku}: {product.sku}
        </p>

        {product.brandName ? (
          <p className="mt-0.5 text-caption text-text-secondary">{product.brandName}</p>
        ) : null}

        <div className="mt-auto pt-4">
          <AddToQuoteButton
            product={{
              productId: product._id,
              name: product.name,
              slug: product.slug,
              sku: product.sku,
              imageUrl: product.image?.url ?? '',
              unit: product.unit,
              quantity: product.minOrderQuantity || 1,
            }}
            className="w-full"
          />
        </div>
      </div>
    </article>
  );
}
