import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, PackageSearch, ShieldCheck, Truck, Warehouse } from 'lucide-react';

import { t } from '@/lib/i18n/en';
import { buildMetadata } from '@/lib/seo';
import { getIndustries } from '@/lib/api/catalogue';

/**
 * About (PROJECT_PLAN.md §9.1, §4.1).
 *
 * Static, purged on demand. The copy here is placeholder pending the client's
 * own — see the note in README's go-live checklist — but the structure and
 * the internal links to the catalogue are what carry the SEO value.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  fallbackTitle: 'About us',
  fallbackDescription:
    'Industrial supplies distribution across Saudi Arabia — welding consumables, safety equipment, scaffolding tools and MRO supply for contractors and plant operators.',
  path: '/about',
});

const CAPABILITIES = [
  {
    icon: Warehouse,
    title: 'Stock held locally',
    body: 'Fast-moving consumables held in the Eastern Province, so a shutdown does not wait on an import.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliant supply',
    body: 'Aramco-compliant scaffolding tags, certified PPE and consumables with traceable documentation.',
  },
  {
    icon: Truck,
    title: 'Kingdom-wide delivery',
    body: 'Regular routes into Dammam, Jubail, Yanbu, Riyadh and Jeddah, with project deliveries to site.',
  },
  {
    icon: PackageSearch,
    title: 'Technical selection',
    body: 'Help choosing the right consumable for the process, base metal and inspection regime.',
  },
];

export default async function AboutPage() {
  const industries = await getIndustries().catch(() => []);

  return (
    <>
      <section className="bg-surface-inverse text-text-on-inverse">
        <div className="container-page py-16">
          <h1 className="max-w-[20ch] font-display text-display font-bold">
            Industrial consumables, supplied properly
          </h1>
          <p className="mt-4 max-w-[62ch] text-body-lg text-white/75">
            We supply welding and MRO consumables to contractors, fabricators and plant operators
            across Saudi Arabia — the parts that get consumed on every shift and stop the job when
            they run out.
          </p>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="prose-measure space-y-4 text-body text-text-secondary">
          <p>
            Industrial supply is a service business wearing a product business&rsquo;s clothes. The
            catalogue matters, but what actually decides whether a shutdown runs to schedule is
            whether the right consumable is on the shelf, correctly certified, and on a truck the
            same day.
          </p>
          <p>
            That is what we have built the business around: depth in the lines that get used
            constantly — welding consumables, abrasives, safety equipment, scaffolding tools — and
            the documentation to go with them.
          </p>
          <p>
            Pricing is quoted per customer against volume and contract terms, which is why you will
            not find prices on this site. Build a request from the catalogue and we will come back
            with pricing, availability and lead times.
          </p>
        </div>
      </section>

      <section className="border-y border-border-subtle bg-surface-raised">
        <div className="container-page grid gap-8 py-14 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <Icon aria-hidden className="size-6 shrink-0 text-action-secondary" />
              <div>
                <h2 className="font-display text-h3 font-semibold text-surface-inverse">{title}</h2>
                <p className="mt-1 max-w-[46ch] text-body-sm text-text-secondary">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {industries.length > 0 ? (
        <section className="container-page py-16">
          <h2 className="font-display text-h1 font-bold text-surface-inverse">Who we supply</h2>

          <ul className="mt-6 flex flex-wrap gap-2">
            {industries.map((industry) => (
              <li key={industry._id}>
                <Link
                  href={`/industries/${industry.slug}`}
                  className="inline-block rounded-[var(--radius-control)] border border-border-subtle px-3 py-1.5 text-body-sm text-text-secondary transition-colors hover:border-action-secondary hover:text-action-secondary"
                >
                  {industry.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bg-surface-inverse text-text-on-inverse">
        <div className="container-page flex flex-col items-start gap-6 py-14 md:flex-row md:items-center md:justify-between">
          <h2 className="font-display text-h1 font-bold">Tell us what the job needs</h2>
          <Link href="/quote-request" className="btn-primary shrink-0">
            {t.quote.submit}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
