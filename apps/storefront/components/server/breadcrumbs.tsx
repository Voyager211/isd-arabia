import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import type { BreadcrumbCrumb } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';

/**
 * Breadcrumb trail. A server component — it is a navigation aid and a ranking
 * signal, not an interaction.
 *
 * The current page is the last crumb and is NOT a link: linking a page to
 * itself is noise for a screen reader and a wasted tab stop.
 */
export function Breadcrumbs({
  crumbs,
  basePath = '/category',
  current,
}: {
  crumbs: BreadcrumbCrumb[];
  basePath?: string;
  current: string;
}) {
  return (
    <nav aria-label={t.nav.breadcrumb} className="py-4">
      <ol className="flex flex-wrap items-center gap-1 text-caption text-text-secondary">
        <li className="flex items-center gap-1">
          <Link href="/" className="hover:text-action-secondary">
            {t.nav.home}
          </Link>
          <ChevronRight aria-hidden className="size-3.5 rtl:rotate-180" />
        </li>

        {crumbs.map((crumb) => (
          <li key={crumb.slug} className="flex items-center gap-1">
            <Link href={`${basePath}/${crumb.slug}`} className="hover:text-action-secondary">
              {crumb.name}
            </Link>
            <ChevronRight aria-hidden className="size-3.5 rtl:rotate-180" />
          </li>
        ))}

        <li aria-current="page" className="text-text-primary">
          {current}
        </li>
      </ol>
    </nav>
  );
}
