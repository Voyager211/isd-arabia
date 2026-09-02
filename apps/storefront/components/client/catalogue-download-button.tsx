'use client';

import { Download } from 'lucide-react';

import { t } from '@/lib/i18n/en';

/**
 * Catalogue download entry point (PROJECT_PLAN.md §9.7).
 *
 * Phase 1 renders the button and its accent styling so every entry point —
 * utility bar, footer, home band, listing pages — exists from the start. The
 * lead-capture modal and the signed-URL exchange land in Phase 4; until then
 * this routes to the contact page rather than opening a dead modal.
 *
 * The orange accent is correct here: the catalogue download is one of the two
 * things it is reserved for.
 */
export function CatalogueDownloadButton({ className }: { className?: string }) {
  return (
    <a href="/contact" className={`btn-primary ${className ?? ''}`}>
      <Download aria-hidden className="size-4" />
      {t.catalogue.download}
    </a>
  );
}
