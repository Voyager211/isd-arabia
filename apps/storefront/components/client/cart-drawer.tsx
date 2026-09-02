'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';

import { t } from '@/lib/i18n/en';
import { useCart } from '@/context/cart-context';
import { cloudinaryUrl, PLACEHOLDER_IMAGE } from '@/lib/cloudinary';

/**
 * Quote cart drawer (PROJECT_PLAN.md §9.1).
 *
 * Slides from the inline-end edge. Mounted once in the root layout so it is
 * reachable from every page.
 */
export function CartDrawer() {
  const { items, itemCount, isOpen, isHydrated, closeCart, setQuantity, removeItem } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus is trapped while open and restored to whatever opened the drawer —
  // required by the accessibility floor (§5.5).
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCart();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus();
    };
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60">
      <div className="absolute inset-0 bg-black/40" onClick={closeCart} aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.cart.title}
        tabIndex={-1}
        className="absolute inset-y-0 end-0 flex w-[min(92vw,420px)] flex-col bg-surface-page shadow-overlay outline-none"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle px-4">
          <h2 className="font-display text-h3 font-semibold text-surface-inverse">
            {t.cart.title}
            {isHydrated && itemCount > 0 ? (
              <span className="ms-2 text-body-sm font-normal text-text-secondary" data-tabular>
                {t.cart.itemCount(itemCount)}
              </span>
            ) : null}
          </h2>
          <button type="button" onClick={closeCart} aria-label={t.common.close} className="p-2">
            <X aria-hidden className="size-5" />
          </button>
        </div>

        {!isHydrated ? (
          // The persisted cart has not been read yet. Rendering a count here
          // would disagree with the server HTML (§10).
          <div className="flex-1 p-4">
            <div className="h-20 animate-pulse rounded-[var(--radius-card)] bg-surface-sunken" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-body font-semibold text-text-primary">{t.cart.empty}</p>
            <p className="max-w-[32ch] text-body-sm text-text-secondary">{t.cart.emptyHint}</p>
            <Link href="/products" onClick={closeCart} className="btn-secondary mt-2">
              {t.cart.browseCatalogue}
            </Link>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-border-subtle overflow-y-auto">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-3 p-4">
                <Image
                  src={
                    item.imageUrl ? cloudinaryUrl(item.imageUrl, 'productThumb') : PLACEHOLDER_IMAGE
                  }
                  alt=""
                  width={64}
                  height={64}
                  className="size-16 shrink-0 rounded-[var(--radius-control)] border border-border-subtle bg-white object-contain"
                />

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${item.slug}`}
                    onClick={closeCart}
                    className="line-clamp-2 text-body-sm font-medium text-text-primary hover:text-action-secondary"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-0.5 text-caption text-text-secondary" data-tabular>
                    {item.sku}
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-[var(--radius-control)] border border-border-subtle">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                        aria-label={t.cart.decrease}
                        className="p-1.5 text-text-secondary hover:text-text-primary"
                      >
                        <Minus aria-hidden className="size-3.5" />
                      </button>
                      <span className="w-8 text-center text-body-sm" data-tabular>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        aria-label={t.cart.increase}
                        className="p-1.5 text-text-secondary hover:text-text-primary"
                      >
                        <Plus aria-hidden className="size-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      aria-label={`${t.cart.remove}: ${item.name}`}
                      className="ms-auto p-1.5 text-text-muted hover:text-status-lost"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {isHydrated && items.length > 0 ? (
          <div className="shrink-0 border-t border-border-subtle p-4">
            <Link href="/quote-cart" onClick={closeCart} className="btn-primary w-full">
              {t.cart.review}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
