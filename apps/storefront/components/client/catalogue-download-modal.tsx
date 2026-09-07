'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Download, FileText, Loader2, X } from 'lucide-react';

import type { CatalogueDownloadResponse, CataloguePublic } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { api, normaliseError } from '@/lib/api/client';
import { cloudinaryUrl } from '@/lib/cloudinary';
import {
  catalogueLeadSchema,
  type CatalogueLeadValues,
} from '@/lib/validation/quote-request.schema';

/**
 * Lead-capture modal (PROJECT_PLAN.md §9.7).
 *
 * Four fields and a consent box. Every extra field on a gate like this
 * measurably costs completions, and the sales team can ask the rest once
 * they are talking.
 *
 * On success it opens the signed URL in a new tab AND shows a manual link.
 * The manual link is not redundant: `window.open` from inside an async
 * callback is frequently blocked as a popup, and a blocked download after a
 * completed form is the worst possible outcome for a lead that just converted.
 */

type FormValues = CatalogueLeadValues;

export function CatalogueDownloadModal({
  catalogue,
  onClose,
}: {
  catalogue: CataloguePublic;
  onClose: () => void;
}) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(catalogueLeadSchema) });

  // Focus trap and restoration, per the accessibility floor (§5.5).
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const focusable = panelRef.current?.querySelector<HTMLElement>('input, button');
    (focusable ?? panelRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const targets = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!targets.length) return;

      const first = targets[0];
      const last = targets[targets.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const response = await api.post<{ data: CatalogueDownloadResponse }>('/catalogue/download', {
        name: values.name,
        company: values.company,
        email: values.email,
        phone: values.phone,
        website: values.website || undefined,
      });

      const url = response.data.data.downloadUrl;
      setDownloadUrl(url);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setFormError(normaliseError(error).message);
    }
  });

  const sizeMb = (catalogue.sizeBytes / 1_048_576).toFixed(1);

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalogue-modal-title"
        tabIndex={-1}
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-card)] bg-surface-page shadow-overlay outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="absolute end-3 top-3 p-2 text-text-secondary hover:text-text-primary"
        >
          <X aria-hidden className="size-5" />
        </button>

        <div className="p-6">
          {downloadUrl ? (
            <div className="text-center">
              <CheckCircle2 aria-hidden className="mx-auto size-10 text-status-won" />
              <h2
                id="catalogue-modal-title"
                className="mt-3 font-display text-h2 font-semibold text-surface-inverse"
              >
                {t.catalogue.successTitle}
              </h2>
              <p className="mt-2 text-body-sm text-text-secondary">{t.catalogue.successBody}</p>

              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-5"
              >
                <Download aria-hidden className="size-4" />
                {t.catalogue.downloadAgain}
              </a>
            </div>
          ) : (
            <>
              <div className="flex gap-4">
                {catalogue.coverImage ? (
                  <Image
                    src={cloudinaryUrl(catalogue.coverImage.url, 'catalogueCover')}
                    alt={catalogue.coverImage.alt || catalogue.title}
                    width={96}
                    height={128}
                    className="h-32 w-24 shrink-0 rounded border border-border-subtle bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded border border-border-subtle bg-surface-raised">
                    <FileText aria-hidden className="size-8 text-text-muted" />
                  </div>
                )}

                <div className="min-w-0">
                  <h2
                    id="catalogue-modal-title"
                    className="font-display text-h2 font-semibold text-surface-inverse"
                  >
                    {t.catalogue.downloadTitle}
                  </h2>
                  <p className="mt-1 text-body-sm text-text-secondary">
                    {catalogue.title} · {catalogue.version}
                  </p>
                  {/* The file size is shown so visitors on a phone can decide
                      before starting a 30 MB download (§13.5). */}
                  <p className="mt-0.5 text-caption text-text-secondary" data-tabular>
                    {t.catalogue.fileSize(sizeMb)}
                    {catalogue.pageCount ? ` · ${t.catalogue.pageCount(catalogue.pageCount)}` : ''}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-body-sm text-text-secondary">{t.catalogue.downloadIntro}</p>

              <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
                <Field id="cat-name" label={t.quote.fields.name} error={errors.name?.message}>
                  <input
                    id="cat-name"
                    autoComplete="name"
                    {...register('name')}
                    className="form-input"
                  />
                </Field>

                <Field
                  id="cat-company"
                  label={t.quote.fields.company}
                  error={errors.company?.message}
                >
                  <input
                    id="cat-company"
                    autoComplete="organization"
                    {...register('company')}
                    className="form-input"
                  />
                </Field>

                <Field id="cat-email" label={t.quote.fields.email} error={errors.email?.message}>
                  <input
                    id="cat-email"
                    type="email"
                    autoComplete="email"
                    {...register('email')}
                    className="form-input"
                  />
                </Field>

                <Field id="cat-phone" label={t.quote.fields.phone} error={errors.phone?.message}>
                  <input
                    id="cat-phone"
                    type="tel"
                    autoComplete="tel"
                    {...register('phone')}
                    className="form-input"
                  />
                </Field>

                {/* Honeypot: off-screen and out of the tab order. */}
                <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="cat-website">Website</label>
                  <input
                    id="cat-website"
                    tabIndex={-1}
                    autoComplete="off"
                    {...register('website')}
                  />
                </div>

                <div>
                  <label className="flex items-start gap-2 text-body-sm">
                    <input type="checkbox" {...register('consent')} className="mt-1 size-4" />
                    <span>{t.catalogue.consent}</span>
                  </label>
                  {errors.consent ? (
                    <p role="alert" className="mt-1 text-caption text-status-lost">
                      {errors.consent.message}
                    </p>
                  ) : null}
                </div>

                {formError ? (
                  <p
                    role="alert"
                    aria-live="assertive"
                    className="rounded-[var(--radius-control)] border border-status-lost/30 bg-status-lost/5 px-3 py-2 text-body-sm text-status-lost"
                  >
                    {formError}
                  </p>
                ) : null}

                <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                  {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                  {t.catalogue.submit}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-caption font-semibold text-text-secondary">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-caption text-status-lost">
          {error}
        </p>
      ) : null}
    </div>
  );
}
