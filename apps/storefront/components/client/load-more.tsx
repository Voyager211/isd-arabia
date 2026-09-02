'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';

import { t } from '@/lib/i18n/en';

/**
 * Pagination control (PROJECT_PLAN.md §9.3).
 *
 * A button that advances `?page=`, not infinite scroll. Infinite scroll breaks
 * back-button restoration — a visitor who opens a product and returns lands at
 * the top of page 1 — and hides deeper pages from crawlers entirely.
 *
 * Because the page number is in the URL, each step is a real, linkable page.
 */
export function LoadMore({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (page >= totalPages) return null;

  const nextHref = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page + 1));
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => router.push(nextHref(), { scroll: false }))}
        className="btn-secondary"
      >
        {isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        {t.listing.loadMore}
      </button>
    </div>
  );
}
