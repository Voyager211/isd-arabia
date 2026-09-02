'use client';

import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import type { CartItem } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { useCart } from '@/context/cart-context';
import { CONTACT } from '@/lib/site-config';

/**
 * Quantity stepper plus the two detail-page actions (PROJECT_PLAN.md §9.4).
 *
 * The quantity floor is the product's minimum order quantity, not 1 — the
 * stepper should not let a buyer assemble a request the supplier cannot fill.
 */
export function AddToQuotePanel({
  product,
  minOrderQuantity,
}: {
  product: CartItem;
  minOrderQuantity: number;
}) {
  const { addItem, hasItem, isHydrated, openCart } = useCart();
  const [quantity, setQuantity] = useState(minOrderQuantity);

  const inCart = isHydrated && hasItem(product.productId);

  const onAdd = () => {
    addItem({ ...product, quantity });
    toast.success(t.cart.added, {
      description: `${product.name} × ${quantity}`,
      action: { label: t.cart.review, onClick: openCart },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-body-sm text-text-secondary">{t.cart.quantity}</span>

        <div className="flex items-center rounded-[var(--radius-control)] border border-border-subtle">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(minOrderQuantity, value - 1))}
            aria-label={t.cart.decrease}
            className="p-2 text-text-secondary hover:text-text-primary"
          >
            <Minus aria-hidden className="size-4" />
          </button>

          <input
            type="number"
            inputMode="numeric"
            min={minOrderQuantity}
            value={quantity}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              setQuantity(
                Number.isFinite(parsed) ? Math.max(minOrderQuantity, parsed) : minOrderQuantity,
              );
            }}
            aria-label={t.cart.quantity}
            className="w-14 border-x border-border-subtle bg-transparent py-2 text-center text-body-sm outline-none"
            data-tabular
          />

          <button
            type="button"
            onClick={() => setQuantity((value) => value + 1)}
            aria-label={t.cart.increase}
            className="p-2 text-text-secondary hover:text-text-primary"
          >
            <Plus aria-hidden className="size-4" />
          </button>
        </div>

        {minOrderQuantity > 1 ? (
          <span className="text-caption text-text-secondary">
            {t.product.minOrder}: {minOrderQuantity}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onAdd} className="btn-primary flex-1 sm:flex-none">
          {inCart ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <Plus aria-hidden className="size-4" />
          )}
          {t.cart.addToQuote}
        </button>

        <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="btn-secondary">
          {t.product.requestCallback}
        </a>
      </div>
    </div>
  );
}
