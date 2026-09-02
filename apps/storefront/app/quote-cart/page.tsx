import type { Metadata } from 'next';

import { QuoteCart } from '@/components/client/quote-cart';

/**
 * Quotation cart (PROJECT_PLAN.md §4.1, §9.8).
 *
 * Client-rendered and noindex: the contents live entirely in the visitor's
 * own localStorage, so there is nothing for the server to render and nothing
 * for a crawler to index.
 */
export const metadata: Metadata = {
  title: 'Your quote request',
  robots: { index: false, follow: false },
};

export default function QuoteCartPage() {
  return (
    <div className="container-page py-10">
      <QuoteCart />
    </div>
  );
}
