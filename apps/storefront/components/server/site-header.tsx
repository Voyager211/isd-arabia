import Link from 'next/link';
import { Clock, Mail, Phone } from 'lucide-react';

import type { CataloguePublic, MenuCategory } from '@isd/shared-types';
import { t } from '@/lib/i18n/en';
import { CartButton } from '@/components/client/cart-button';
import { CatalogueDownloadLink } from '@/components/client/catalogue-download-link';
import { MegaMenu } from '@/components/client/mega-menu';
import { MobileNav } from '@/components/client/mobile-nav';
import { SearchBox } from '@/components/client/search-box';
import { CONTACT } from '@/lib/site-config';

/**
 * Site header — three bands (PROJECT_PLAN.md §9.1).
 *
 * This is a SERVER component. The menu data is fetched on the server in the
 * root layout and passed down as props, so the entire category tree renders in
 * the initial HTML and is crawlable. That matters more here than anywhere else
 * on the site: the mega-menu is the primary internal linking structure for the
 * whole catalogue.
 *
 * Only the genuinely interactive leaves are client components — the mega-menu
 * panel, the search box, the cart button and the mobile drawer.
 */
export function SiteHeader({
  menu,
  catalogue,
}: {
  menu: MenuCategory[];
  catalogue: CataloguePublic | null;
}) {
  return (
    <header className="sticky top-0 z-40 bg-surface-page shadow-resting">
      {/* Band 1 — utility. Hidden below md; the information is duplicated in
          the footer and the mobile drawer, so nothing is lost. */}
      <div className="hidden bg-surface-inverse text-text-on-inverse md:block">
        <div className="container-page flex h-9 items-center justify-between text-caption">
          <div className="flex items-center gap-6">
            <a
              className="flex items-center gap-2 hover:underline"
              href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}
            >
              <Phone aria-hidden className="size-3.5" />
              <span className="sr-only">{t.utility.callUs}: </span>
              {CONTACT.phone}
            </a>
            <a className="flex items-center gap-2 hover:underline" href={`mailto:${CONTACT.email}`}>
              <Mail aria-hidden className="size-3.5" />
              <span className="sr-only">{t.utility.emailUs}: </span>
              {CONTACT.email}
            </a>
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <Clock aria-hidden className="size-3.5" />
              {t.utility.hours}
            </span>
            {catalogue ? (
              <CatalogueDownloadLink className="hover:underline" catalogue={catalogue} />
            ) : null}
          </div>
        </div>
      </div>

      {/* Band 2 — brand, search, quote cart. */}
      <div className="border-b border-border-subtle">
        <div className="container-page flex h-16 items-center gap-4 lg:h-20 lg:gap-8">
          <MobileNav menu={menu} />

          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="font-display text-h2 leading-none font-bold text-surface-inverse">
              {t.brand.name}
            </span>
          </Link>

          <div className="ms-auto hidden max-w-xl flex-1 lg:ms-0 lg:block">
            <SearchBox />
          </div>

          <div className="ms-auto flex items-center gap-2">
            <CartButton />
          </div>
        </div>
      </div>

      {/* Band 3 — navigation. The two product lines open the mega-menu. */}
      <nav
        aria-label={t.nav.mainNavigation}
        className="hidden border-b border-border-subtle lg:block"
      >
        <div className="container-page">
          <MegaMenu menu={menu} />
        </div>
      </nav>

      {/* Search moves under the bands on smaller viewports rather than
          disappearing — part-number search is how most buyers arrive. */}
      <div className="container-page py-3 lg:hidden">
        <SearchBox />
      </div>
    </header>
  );
}
