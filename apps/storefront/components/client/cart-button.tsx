'use client';

import { FileText } from 'lucide-react';

import { t } from '@/lib/i18n/en';
import { useCart } from '@/context/cart-context';

/**
 * Quote cart trigger with a live item-count badge.
 *
 * The badge is the classic hydration-mismatch site on this codebase
 * (PROJECT_PLAN.md §10). The server has no localStorage, so it renders no
 * badge; rendering the persisted count on the first client render makes the
 * client HTML disagree with the server HTML and React warns — or worse,
 * silently discards the server tree.
 *
 * `isHydrated` is the guard. Until it flips, this renders exactly what the
 * server rendered.
 */
export function CartButton() {
  const { itemCount, isHydrated, openCart } = useCart();
  const showBadge = isHydrated && itemCount > 0;

  return (
    <button
      type="button"
      onClick={openCart}
      className="relative flex items-center gap-2 rounded-[var(--radius-control)] border border-border-subtle px-3 py-2 text-body-sm font-semibold text-text-primary transition-colors hover:border-action-primary hover:text-action-primary"
      aria-label={t.cart.open}
    >
      <FileText aria-hidden className="size-5" />
      <span className="hidden sm:inline">{t.cart.title}</span>

      {showBadge ? (
        <span
          className="absolute -end-2 -top-2 flex size-5 items-center justify-center rounded-full bg-action-primary text-[11px] font-bold text-text-on-accent"
          data-tabular
        >
          {itemCount > 99 ? '99+' : itemCount}
          {/* The visible number is decorative; screen readers get the phrase. */}
          <span className="sr-only"> {t.cart.itemCount(itemCount)}</span>
        </span>
      ) : null}
    </button>
  );
}
