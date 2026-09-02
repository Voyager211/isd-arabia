'use client';

import { Check, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { CartItem } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { useCart } from '@/context/cart-context';

/**
 * The accent action (PROJECT_PLAN.md §5.1).
 *
 * The "already added" state is gated on `isHydrated`: before the persisted
 * cart has been read, this must render exactly what the server rendered, or
 * the tick appears mid-hydration and React reports a mismatch (§10).
 */
export function AddToQuoteButton({
  product,
  className,
}: {
  product: CartItem;
  className?: string;
}) {
  const { addItem, hasItem, isHydrated, openCart } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const inCart = isHydrated && hasItem(product.productId);

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), 1600);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const onClick = () => {
    addItem(product);
    setJustAdded(true);
    toast.success(t.cart.added, {
      description: product.name,
      action: { label: t.cart.review, onClick: openCart },
    });
  };

  return (
    <button type="button" onClick={onClick} className={`btn-primary ${className ?? ''}`}>
      {justAdded || inCart ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <Plus aria-hidden className="size-4" />
      )}
      {t.cart.addToQuote}
    </button>
  );
}
