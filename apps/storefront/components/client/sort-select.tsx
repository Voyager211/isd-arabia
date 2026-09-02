'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId } from 'react';

import { PRODUCT_SORTS, type ProductSort } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';

/**
 * Sort control. Writes to the query string like every other listing control,
 * so the sorted view is shareable and survives a back-navigation.
 */
export function SortSelect({ hasSearch = false }: { hasSearch?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = useId();

  const current =
    (searchParams.get('sort') as ProductSort | null) ?? (hasSearch ? 'relevance' : 'newest');

  // 'relevance' has no meaning without a search term, so it is only offered
  // where one exists.
  const options = PRODUCT_SORTS.filter((sort) => sort !== 'relevance' || hasSearch);

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-caption text-text-secondary">
        {t.listing.sort}
      </label>
      <select
        id={id}
        value={current}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[var(--radius-control)] border border-border-subtle bg-surface-page px-2 py-1.5 text-body-sm"
      >
        {options.map((sort) => (
          <option key={sort} value={sort}>
            {t.listing.sortOptions[sort]}
          </option>
        ))}
      </select>
    </div>
  );
}
