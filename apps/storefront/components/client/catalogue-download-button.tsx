'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

import type { CataloguePublic } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { CatalogueDownloadModal } from './catalogue-download-modal';

/**
 * Catalogue download entry point (PROJECT_PLAN.md §9.7).
 *
 * Appears in the utility bar, the footer, the home page band and on listing
 * pages. When the active file is not gated it links straight to it; otherwise
 * it opens the lead-capture modal.
 *
 * The orange accent is correct here — the catalogue download is one of the two
 * things it is reserved for (§5.1).
 */
export function CatalogueDownloadButton({
  catalogue,
  className,
  variant = 'primary',
}: {
  /** Null when nothing is published; the button then renders nothing. */
  catalogue: CataloguePublic | null;
  className?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!catalogue) return null;

  const buttonClass = `${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} ${className ?? ''}`;

  // Ungated: no modal, no round trip, just the file.
  if (!catalogue.requiresLead && catalogue.downloadUrl) {
    return (
      <a
        href={catalogue.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
      >
        <Download aria-hidden className="size-4" />
        {t.catalogue.download}
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={buttonClass}>
        <Download aria-hidden className="size-4" />
        {t.catalogue.download}
      </button>

      {isOpen ? (
        <CatalogueDownloadModal catalogue={catalogue} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}
