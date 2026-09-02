import Link from 'next/link';
import { ArrowRight, PackageSearch, ShieldCheck, Truck } from 'lucide-react';

import { t } from '@/lib/i18n/en';
import { getMenu } from '@/lib/api/catalogue';
import { CatalogueDownloadButton } from '@/components/client/catalogue-download-button';

/**
 * Home page (PROJECT_PLAN.md §9.2).
 *
 * ISR with a one-hour window plus on-demand purge on the `home` tag. A server
 * component throughout — nothing here needs the client.
 *
 * Phase 1 establishes the hero, category grid, trust band and CTA band. The
 * new-arrivals rail, featured grid, brand strip and catalogue band land in
 * Phase 5 once the product endpoints exist.
 */
export const revalidate = 3600;

export default async function HomePage() {
  const menu = await getMenu().catch(() => []);
  const topCategories = menu.flatMap((group) => group.children).slice(0, 8);

  return (
    <>
      {/* Hero — the one orchestrated entrance on the whole site (§5.4). */}
      <section className="bg-surface-inverse text-text-on-inverse">
        <div className="container-page grid gap-8 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div className="motion-safe:animate-[fade-up_600ms_var(--ease-out)_both]">
            <h1 className="max-w-[18ch] font-display text-display font-bold">
              Welding and MRO consumables, supplied across the Kingdom
            </h1>
            <p className="mt-4 max-w-[52ch] text-body-lg text-white/75">
              A deep catalogue of welding, safety, scaffolding and cutting consumables for
              industrial buyers. Build a request, send it over, and our team comes back with pricing
              and availability.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="btn-secondary">
                Browse the catalogue
              </Link>
              {/* Accent = quote action. That is the only thing it means (§5.1). */}
              <Link href="/quote-request" className="btn-primary">
                Request a quote
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="aspect-[4/3] rounded-[var(--radius-card)] border border-white/10 bg-white/5" />
          </div>
        </div>
      </section>

      {/* Category grid */}
      {topCategories.length > 0 ? (
        <section className="container-page py-16">
          <h2 className="font-display text-h1 font-bold text-surface-inverse">Shop by category</h2>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {topCategories.map((category) => (
              <li key={category._id}>
                <Link
                  href={`/category/${category.slug}`}
                  className="group flex h-full flex-col justify-between rounded-[var(--radius-card)] border border-border-subtle bg-surface-raised p-5 shadow-resting transition-colors hover:border-action-secondary"
                >
                  <span className="font-display text-h3 font-semibold text-surface-inverse">
                    {category.name}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-1 text-body-sm text-action-secondary">
                    {t.nav.viewAll(category.name)}
                    <ArrowRight
                      aria-hidden
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Trust band */}
      <section className="border-y border-border-subtle bg-surface-raised">
        <div className="container-page grid gap-8 py-12 md:grid-cols-3">
          {[
            {
              icon: Truck,
              title: 'Kingdom-wide delivery',
              body: 'Supply into Dammam, Jubail, Yanbu, Riyadh and every major industrial city.',
            },
            {
              icon: ShieldCheck,
              title: 'Certified supply',
              body: 'Aramco-compliant scaffolding tags, certified PPE and traceable consumables.',
            },
            {
              icon: PackageSearch,
              title: 'Technical support',
              body: 'Talk to people who know the difference between a WP-17 and a WP-26.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <Icon aria-hidden className="size-6 shrink-0 text-action-secondary" />
              <div>
                <h3 className="font-display text-h3 font-semibold text-surface-inverse">{title}</h3>
                <p className="mt-1 max-w-[40ch] text-body-sm text-text-secondary">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Catalogue band */}
      <section className="container-page py-16">
        <div className="flex flex-col items-start gap-6 rounded-[var(--radius-card)] border border-border-subtle p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-h2 font-semibold text-surface-inverse">
              {t.catalogue.downloadTitle}
            </h2>
            <p className="mt-2 max-w-[56ch] text-body-sm text-text-secondary">
              The full product range in one PDF — part numbers, sizes and specifications for offline
              reference and internal circulation.
            </p>
          </div>
          <CatalogueDownloadButton className="shrink-0" />
        </div>
      </section>
    </>
  );
}
