import Link from 'next/link';
import type { Metadata } from 'next';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';

import { t } from '@/lib/i18n/en';
import { buildMetadata, jsonLdScript } from '@/lib/seo';
import { CONTACT, siteUrl } from '@/lib/site-config';

/**
 * Contact (PROJECT_PLAN.md §9.1).
 *
 * Deliberately NOT a contact form. The quotation flow is the enquiry channel
 * this platform is built around; a second, weaker form here would split
 * incoming enquiries across two places, only one of which the admin can work.
 * So this page gives the direct channels and routes everything else to the
 * quotation flow.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  fallbackTitle: 'Contact',
  fallbackDescription:
    'Reach the ISD Arabia team — phone, email and address, plus business hours across the Kingdom.',
  path: '/contact',
});

/**
 * LocalBusiness structured data, so the phone, address and opening hours can
 * surface directly in search results.
 */
function localBusinessJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: t.brand.name,
    description: t.brand.tagline,
    url: siteUrl('/contact'),
    telephone: CONTACT.phone,
    email: CONTACT.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: CONTACT.address.line1,
      addressLocality: CONTACT.address.line2,
      addressCountry: 'SA',
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      opens: '08:00',
      closes: '17:00',
    },
  };
}

const CHANNELS = [
  {
    icon: Phone,
    label: 'Phone',
    value: CONTACT.phone,
    href: `tel:${CONTACT.phone.replace(/\s/g, '')}`,
    hint: 'Fastest for stock checks and urgent site requirements.',
  },
  {
    icon: Mail,
    label: 'Email',
    value: CONTACT.email,
    href: `mailto:${CONTACT.email}`,
    hint: 'Send drawings, specifications or a bill of materials.',
  },
];

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(localBusinessJsonLd()) }}
      />

      <div className="container-page py-16">
        <h1 className="font-display text-display font-bold text-surface-inverse">
          {t.nav.contact}
        </h1>
        <p className="prose-measure mt-3 text-body-lg text-text-secondary">
          For pricing and availability, the quickest route is a quotation request — it reaches the
          team with the part numbers and quantities already attached.
        </p>

        <div className="mt-8">
          <Link href="/quote-request" className="btn-primary">
            {t.quote.submit}
          </Link>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {CHANNELS.map(({ icon: Icon, label, value, href, hint }) => (
            <div
              key={label}
              className="rounded-[var(--radius-card)] border border-border-subtle p-6"
            >
              <Icon aria-hidden className="size-5 text-action-secondary" />
              <h2 className="mt-3 font-display text-h3 font-semibold text-surface-inverse">
                {label}
              </h2>
              <a
                href={href}
                className="mt-1 block text-body text-action-secondary hover:underline"
                data-tabular
              >
                {value}
              </a>
              <p className="mt-2 text-body-sm text-text-secondary">{hint}</p>
            </div>
          ))}

          <div className="rounded-[var(--radius-card)] border border-border-subtle p-6">
            <Clock aria-hidden className="size-5 text-action-secondary" />
            <h2 className="mt-3 font-display text-h3 font-semibold text-surface-inverse">Hours</h2>
            <p className="mt-1 text-body text-text-primary">{t.utility.hours}</p>
            <p className="mt-2 text-body-sm text-text-secondary">
              Requests submitted outside these hours are picked up the next working morning.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-[var(--radius-card)] border border-border-subtle p-6">
          <MapPin aria-hidden className="size-5 text-action-secondary" />
          <h2 className="mt-3 font-display text-h3 font-semibold text-surface-inverse">Address</h2>
          <address className="mt-1 text-body text-text-primary not-italic">
            {CONTACT.address.line1}
            <br />
            {CONTACT.address.line2}
            <br />
            {CONTACT.address.country}
          </address>
        </div>
      </div>
    </>
  );
}
