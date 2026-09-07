import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, PackageSearch, ShieldCheck, Truck } from 'lucide-react';

import { t } from '@/lib/i18n/en';
import { getActiveCatalogue, getBrands, getIndustries, getMenu } from '@/lib/api/catalogue';
import { getProducts } from '@/lib/api/products';
import { buildMetadata, jsonLdScript, organizationJsonLd } from '@/lib/seo';
import { cloudinaryUrl } from '@/lib/cloudinary';
import { ProductCard } from '@/components/server/product-card';
import { CatalogueDownloadButton } from '@/components/client/catalogue-download-button';

/**
 * Home page (PROJECT_PLAN.md §9.2).
 *
 * ISR at one hour plus on-demand purge on the `home` tag. Every section is a
 * server component — the only client leaves are the add-to-quote buttons
 * inside the product cards and the catalogue download button.
 *
 * Each fetch is caught independently: a failing endpoint should cost its own
 * section, not the whole page. On the Render free tier a cold start can make
 * one call time out while the rest succeed, and a home page missing its
 * featured rail is a far better outcome than a 500.
 */
export const revalidate = 3600;

/**
 * The home page needs its own metadata, not the layout's defaults.
 *
 * Inheriting them left it as the ONE page on the site with no canonical, which
 * is the worst place to miss: it takes the most traffic and is the most likely
 * to be shared carrying ?utm_source= or ?fbclid=, each of which becomes a
 * separate indexable duplicate without one.
 */
export const metadata: Metadata = buildMetadata({
  fallbackTitle: `${t.brand.name} — ${t.brand.tagline}`,
  fallbackDescription:
    'Industrial supplies distribution across Saudi Arabia — welding consumables, safety equipment, scaffolding tools and MRO supply. Browse the catalogue and request a quotation.',
  path: '/',
  // The title already carries the brand name; the layout template would
  // render it twice.
  absoluteTitle: true,
});

export default async function HomePage() {
  const [menu, catalogue, brands, industries, newArrivals, featured] = await Promise.all([
    getMenu().catch(() => []),
    getActiveCatalogue().catch(() => null),
    getBrands().catch(() => []),
    getIndustries().catch(() => []),
    getProducts({ newArrival: true, limit: 12 })
      .then((result) => result.products)
      .catch(() => []),
    getProducts({ featured: true, limit: 8 })
      .then((result) => result.products)
      .catch(() => []),
  ]);

  const topCategories = menu.flatMap((group) => group.children).slice(0, 8);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
      />

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

      {/*
        New arrivals as a horizontal rail rather than a grid: twelve products
        laid out as a grid would dominate the page, and a rail signals "there
        is more here" without pushing everything below it off the fold.
      */}
      {newArrivals.length > 0 ? (
        <section className="border-y border-border-subtle bg-surface-raised py-12">
          <div className="container-page">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-h1 font-bold text-surface-inverse">New arrivals</h2>
              <Link
                href="/products?sort=newest"
                className="shrink-0 text-body-sm text-action-secondary hover:underline"
              >
                {t.nav.allProducts}
              </Link>
            </div>

            <ul className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
              {newArrivals.map((product) => (
                <li
                  key={product._id}
                  className="w-[70vw] shrink-0 snap-start sm:w-[45vw] lg:w-[calc((100%-3rem)/4)]"
                >
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {featured.length > 0 ? (
        <section className="container-page py-16">
          <h2 className="font-display text-h1 font-bold text-surface-inverse">Featured products</h2>

          <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {featured.map((product) => (
              <li key={product._id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {brands.length > 0 ? (
        <section className="border-y border-border-subtle py-12">
          <div className="container-page">
            <h2 className="font-display text-h2 font-semibold text-surface-inverse">
              Brands we supply
            </h2>

            <ul className="mt-6 flex flex-wrap items-center gap-4">
              {brands.map((brand) => (
                <li key={brand._id}>
                  <Link
                    href={`/brands/${brand.slug}`}
                    className="flex h-16 min-w-32 items-center justify-center rounded-[var(--radius-card)] border border-border-subtle px-4 transition-colors hover:border-action-secondary"
                  >
                    {brand.logo ? (
                      <Image
                        src={cloudinaryUrl(brand.logo.url, 'brandLogo')}
                        alt={brand.logo.alt || brand.name}
                        width={120}
                        height={48}
                        className="h-8 w-auto object-contain"
                      />
                    ) : (
                      <span className="font-display text-h3 font-semibold text-surface-inverse">
                        {brand.name}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {industries.length > 0 ? (
        <section className="container-page py-16">
          <h2 className="font-display text-h1 font-bold text-surface-inverse">
            {t.nav.industries}
          </h2>
          <p className="prose-measure mt-2 text-body text-text-secondary">
            The sectors we supply, and the consumables each one runs on.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {industries.slice(0, 9).map((industry) => (
              <li key={industry._id}>
                <Link
                  href={`/industries/${industry.slug}`}
                  className="flex h-full flex-col rounded-[var(--radius-card)] border border-border-subtle p-5 transition-colors hover:border-action-secondary"
                >
                  <span className="font-display text-h3 font-semibold text-surface-inverse">
                    {industry.name}
                  </span>
                  {industry.description ? (
                    <span className="mt-2 text-body-sm text-text-secondary">
                      {industry.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      {catalogue ? (
        <section className="container-page py-16">
          <div className="flex flex-col items-start gap-6 rounded-[var(--radius-card)] border border-border-subtle p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-h2 font-semibold text-surface-inverse">
                {t.catalogue.downloadTitle}
              </h2>
              <p className="mt-2 max-w-[56ch] text-body-sm text-text-secondary">
                The full product range in one PDF — part numbers, sizes and specifications for
                offline reference and internal circulation.
              </p>
            </div>
            <CatalogueDownloadButton catalogue={catalogue} className="shrink-0" />
          </div>
        </section>
      ) : null}

      {/* Closing CTA band. */}
      <section className="bg-surface-inverse text-text-on-inverse">
        <div className="container-page flex flex-col items-start gap-6 py-14 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-h1 font-bold">Ready to price up a job?</h2>
            <p className="mt-2 max-w-[52ch] text-body text-white/75">
              Build a request from the catalogue and our team will come back with pricing,
              availability and lead times.
            </p>
          </div>
          <Link href="/quote-request" className="btn-primary shrink-0">
            {t.quote.submit}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
