'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { t } from '@/lib/i18n/en';
import { useCart } from '@/context/cart-context';
import { cloudinaryUrl, PLACEHOLDER_IMAGE } from '@/lib/cloudinary';

/**
 * The full quote-cart page (PROJECT_PLAN.md §9.8).
 *
 * A larger surface than the drawer: it adds the per-line note field, which is
 * where a buyer says "2.4mm collet" or "certified batch required" — the detail
 * that turns a list of part numbers into something the sales team can actually
 * quote against.
 */
export function QuoteCart() {
  const { items, itemCount, isHydrated, setQuantity, setNote, removeItem, clearCart } = useCart();

  // Until the persisted cart has been read there is nothing truthful to show.
  // A count rendered here before hydration is the mismatch from §10.
  if (!isHydrated) {
    return (
      <div className="space-y-3" aria-busy>
        <div className="h-8 w-56 animate-pulse rounded bg-surface-sunken" />
        <div className="h-28 animate-pulse rounded-[var(--radius-card)] bg-surface-sunken" />
        <div className="h-28 animate-pulse rounded-[var(--radius-card)] bg-surface-sunken" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border-subtle p-12 text-center">
        <h1 className="font-display text-h1 font-bold text-surface-inverse">{t.cart.title}</h1>
        <p className="mt-3 text-body text-text-secondary">{t.cart.empty}</p>
        <p className="mx-auto mt-1 max-w-[42ch] text-body-sm text-text-secondary">
          {t.cart.emptyHint}
        </p>
        <Link href="/products" className="btn-primary mt-6">
          {t.cart.browseCatalogue}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-bold text-surface-inverse">{t.cart.title}</h1>
          <p className="mt-1 text-body-sm text-text-secondary" data-tabular>
            {t.cart.itemCount(itemCount)} across {items.length}{' '}
            {items.length === 1 ? 'product' : 'products'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            clearCart();
            toast.success(t.cart.cleared);
          }}
          className="text-body-sm text-text-secondary underline hover:text-status-lost"
        >
          {t.cart.clear}
        </button>
      </div>

      <ul className="divide-y divide-border-subtle rounded-[var(--radius-card)] border border-border-subtle">
        {items.map((item) => (
          <li key={item.productId} className="p-4">
            <div className="flex gap-4">
              <Image
                src={
                  item.imageUrl ? cloudinaryUrl(item.imageUrl, 'productThumb') : PLACEHOLDER_IMAGE
                }
                alt=""
                width={80}
                height={80}
                className="size-20 shrink-0 rounded-[var(--radius-control)] border border-border-subtle bg-white object-contain"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${item.slug}`}
                      className="font-display text-h3 font-semibold text-surface-inverse hover:text-action-secondary"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-caption text-text-secondary" data-tabular>
                      {t.product.sku}: {item.sku} · {t.product.unit}: {item.unit}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-[var(--radius-control)] border border-border-subtle">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                        aria-label={`${t.cart.decrease}: ${item.name}`}
                        className="p-2 text-text-secondary hover:text-text-primary"
                      >
                        <Minus aria-hidden className="size-4" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={item.quantity}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          setQuantity(item.productId, Number.isFinite(parsed) ? parsed : 1);
                        }}
                        aria-label={`${t.cart.quantity}: ${item.name}`}
                        className="w-14 border-x border-border-subtle bg-transparent py-2 text-center text-body-sm outline-none"
                        data-tabular
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        aria-label={`${t.cart.increase}: ${item.name}`}
                        className="p-2 text-text-secondary hover:text-text-primary"
                      >
                        <Plus aria-hidden className="size-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        removeItem(item.productId);
                        toast.success(t.cart.removed, { description: item.name });
                      }}
                      aria-label={`${t.cart.remove}: ${item.name}`}
                      className="p-2 text-text-muted hover:text-status-lost"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <label
                    htmlFor={`note-${item.productId}`}
                    className="text-caption text-text-secondary"
                  >
                    {t.cart.lineNote}
                  </label>
                  <input
                    id={`note-${item.productId}`}
                    value={item.note ?? ''}
                    onChange={(event) => setNote(item.productId, event.target.value)}
                    placeholder={t.cart.lineNotePlaceholder}
                    maxLength={500}
                    className="mt-1 w-full rounded-[var(--radius-control)] border border-border-subtle bg-surface-page px-3 py-2 text-body-sm outline-none focus:border-action-secondary"
                  />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <Link href="/products" className="btn-secondary">
          {t.cart.browseCatalogue}
        </Link>
        <Link href="/quote-request" className="btn-primary">
          {t.cart.continue}
        </Link>
      </div>
    </>
  );
}
