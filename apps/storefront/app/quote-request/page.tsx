import type { Metadata } from 'next';

import { QuoteRequestForm } from '@/components/client/quote-request-form';

/**
 * Quotation request form (PROJECT_PLAN.md §9.9).
 *
 * Client-rendered and noindex for the same reason as the cart: it renders the
 * visitor's own local state.
 */
export const metadata: Metadata = {
  title: 'Request a quotation',
  robots: { index: false, follow: false },
};

export default function QuoteRequestPage() {
  return (
    <div className="container-page py-10">
      <QuoteRequestForm />
    </div>
  );
}
