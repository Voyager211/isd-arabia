'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

import type { CataloguePublic } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { CatalogueDownloadModal } from './catalogue-download-modal';

/**
 * The utility-bar variant of the download entry point.
 *
 * Same behaviour as CatalogueDownloadButton, styled as an inline link rather
 * than a button — the accent treatment would be far too loud in a 36px dark
 * utility strip, and the accent is reserved for the primary quote actions
 * anyway (PROJECT_PLAN.md §5.1).
 */
export function CatalogueDownloadLink({
  catalogue,
  className,
}: {
  catalogue: CataloguePublic;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!catalogue.requiresLead && catalogue.downloadUrl) {
    return (
      <a
        href={catalogue.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 ${className ?? ''}`}
      >
        <Download aria-hidden className="size-3.5" />
        {t.catalogue.download}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 ${className ?? ''}`}
      >
        <Download aria-hidden className="size-3.5" />
        {t.catalogue.download}
      </button>

      {isOpen ? (
        <CatalogueDownloadModal catalogue={catalogue} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}
