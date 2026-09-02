import Link from 'next/link';
import type { Metadata } from 'next';
import { CheckCircle2, Clock, Printer } from 'lucide-react';

import { t } from '@/lib/i18n/en';
import { CONTACT } from '@/lib/site-config';
import { PrintButton } from '@/components/client/print-button';

/**
 * Confirmation page (PROJECT_PLAN.md §9.9).
 *
 * No email is sent to the customer (§18 #7), so this page is their ONLY
 * receipt. It has to be complete, unambiguous and printable — hence the quote
 * number set large, the expected response time stated, and a print action.
 *
 * A server component: the quote number comes from the URL, so there is nothing
 * to hydrate except the print button.
 */
export const metadata: Metadata = {
  title: 'Quotation request received',
  robots: { index: false, follow: false },
};

export default async function QuoteSuccessPage({
  params,
}: {
  params: Promise<{ quoteNumber: string }>;
}) {
  const { quoteNumber } = await params;
  const reference = decodeURIComponent(quoteNumber);

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl rounded-[var(--radius-card)] border border-border-subtle p-8 text-center">
        <CheckCircle2 aria-hidden className="mx-auto size-12 text-status-won" />

        <h1 className="mt-4 font-display text-h1 font-bold text-surface-inverse">
          {t.quote.successTitle}
        </h1>
        <p className="prose-measure mx-auto mt-2 text-body text-text-secondary">
          {t.quote.successBody}
        </p>

        <div className="mt-8 rounded-[var(--radius-card)] bg-surface-raised p-6">
          <p className="text-caption font-semibold text-text-secondary">{t.quote.quoteNumber}</p>
          <p
            className="mt-1 font-display text-display font-bold tracking-tight text-surface-inverse"
            data-tabular
          >
            {reference}
          </p>
          <p className="mt-2 text-body-sm text-text-secondary">
            Quote this reference in any follow-up.
          </p>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-body-sm text-text-secondary">
          <Clock aria-hidden className="size-4" />
          {t.quote.responseTime}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/products" className="btn-secondary">
            {t.quote.backToCatalogue}
          </Link>
          <PrintButton>
            <Printer aria-hidden className="size-4" />
            {t.quote.printThis}
          </PrintButton>
        </div>

        <div className="mt-8 border-t border-border-subtle pt-6 text-body-sm text-text-secondary">
          <p>Need to reach us sooner?</p>
          <p className="mt-1">
            <a
              className="text-action-secondary hover:underline"
              href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}
            >
              {CONTACT.phone}
            </a>
            {' · '}
            <a className="text-action-secondary hover:underline" href={`mailto:${CONTACT.email}`}>
              {CONTACT.email}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
