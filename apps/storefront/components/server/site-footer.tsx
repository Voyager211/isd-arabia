import Link from 'next/link';
import { Linkedin, Mail, MapPin, Phone } from 'lucide-react';

import type { Industry } from '@isd/shared-types';
import { t } from '@/lib/i18n/en';
import { CONTACT, SOCIAL } from '@/lib/site-config';
import { CatalogueDownloadButton } from '@/components/client/catalogue-download-button';

/**
 * Site footer (PROJECT_PLAN.md §9.1) — a server component.
 *
 * Four columns, all links rendered server-side. Only the catalogue download
 * button is a client leaf, because it opens the lead-capture modal.
 */
export function SiteFooter({
  industries,
}: {
  industries: Pick<Industry, '_id' | 'name' | 'slug'>[];
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 bg-surface-inverse text-text-on-inverse">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-h2 font-bold">{t.brand.name}</p>
          <p className="mt-3 max-w-[38ch] text-body-sm text-white/70">{t.brand.tagline}</p>

          <div className="mt-6">
            <CatalogueDownloadButton />
          </div>

          <a
            href={SOCIAL.linkedin}
            className="mt-6 inline-flex items-center gap-2 text-body-sm text-white/70 hover:text-white"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Linkedin aria-hidden className="size-4" />
            LinkedIn
          </a>
        </div>

        <nav aria-label={t.footer.information}>
          <h2 className="font-display text-h3 font-semibold">{t.footer.information}</h2>
          <ul className="mt-4 space-y-2 text-body-sm text-white/70">
            <li>
              <Link className="hover:text-white" href="/products">
                {t.nav.allProducts}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/brands">
                {t.nav.brands}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/industries">
                {t.nav.industries}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/about">
                {t.nav.about}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/contact">
                {t.nav.contact}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t.footer.industries}>
          <h2 className="font-display text-h3 font-semibold">{t.footer.industries}</h2>
          <ul className="mt-4 space-y-2 text-body-sm text-white/70">
            {industries.map((industry) => (
              <li key={industry._id}>
                <Link className="hover:text-white" href={`/industries/${industry.slug}`}>
                  {industry.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="font-display text-h3 font-semibold">{t.footer.contact}</h2>
          <address className="mt-4 space-y-3 text-body-sm text-white/70 not-italic">
            <p className="flex gap-2">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {CONTACT.address.line1}
                <br />
                {CONTACT.address.line2}
                <br />
                {CONTACT.address.country}
              </span>
            </p>
            <p className="flex gap-2">
              <Phone aria-hidden className="mt-0.5 size-4 shrink-0" />
              <a className="hover:text-white" href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}>
                {CONTACT.phone}
              </a>
            </p>
            <p className="flex gap-2">
              <Mail aria-hidden className="mt-0.5 size-4 shrink-0" />
              <a className="hover:text-white" href={`mailto:${CONTACT.email}`}>
                {CONTACT.email}
              </a>
            </p>
          </address>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-caption text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>{t.footer.rights(year)}</p>
        </div>
      </div>
    </footer>
  );
}
