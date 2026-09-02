import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import type { AssetRef, UploadSignatureResponse } from '@isd/shared-types';

import { normaliseError, post } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import { FormField } from '@/components/ui/form-field';
import { ImageUploader, imagesHaveAltText } from '@/components/ui/image-uploader';

/**
 * Catalogue PDF upload (PROJECT_PLAN.md §11.7, §13.1, §13.3).
 *
 * The PDF goes straight from the browser to Cloudinary as an `authenticated`
 * `raw` resource. It never passes through the API — a catalogue can be tens of
 * megabytes and a free-tier Node process should not be holding that in memory.
 * `authenticated` is what makes the file unreachable without a signed URL, and
 * therefore what makes the lead form meaningful rather than decorative.
 */

/**
 * A hard cap well under Cloudinary's free-tier limit.
 *
 * Bandwidth is the real constraint (§13.5): a 30 MB PDF downloaded 300 times
 * is 9 GB, more than a third of the monthly allowance. Refusing an oversized
 * file here is cheaper than discovering it on the invoice.
 */
const MAX_PDF_BYTES = 40 * 1024 * 1024;

const schema = z.object({
  title: z.string().min(2, 'Enter a title.').max(160),
  description: z.string().max(2000).optional(),
  version: z.string().min(1, 'Enter a version, e.g. 2026-Q1.').max(40),
  requiresLead: z.boolean(),
  displayOrder: z.coerce.number().int().min(0),
});

type FormValues = z.input<typeof schema>;

interface UploadedPdf {
  url: string;
  publicId: string;
  sizeBytes: number;
}

export function CatalogueUploadSlideOver({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [pdf, setPdf] = useState<UploadedPdf | null>(null);
  const [cover, setCover] = useState<AssetRef[]>([]);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { requiresLead: true, displayOrder: 0 },
  });

  const onPdfSelected = async (file: File | undefined) => {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('The catalogue must be a PDF.');
      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      toast.error(
        `That file is ${(file.size / 1_048_576).toFixed(0)} MB. Compress it below 40 MB first — ` +
          'download bandwidth is the tightest limit on the free Cloudinary tier.',
      );
      return;
    }

    setIsUploadingPdf(true);
    try {
      const signature = await post<UploadSignatureResponse>('/admin/uploads/signature', {
        folder: 'catalogue',
        resourceType: 'raw',
      });

      const form = new FormData();
      form.append('file', file);
      form.append('api_key', signature.apiKey);
      form.append('timestamp', String(signature.timestamp));
      form.append('signature', signature.signature);
      form.append('folder', signature.folder);
      // Must match what the API signed, or Cloudinary rejects the upload.
      form.append('type', 'authenticated');

      const response = await fetch(signature.uploadUrl, { method: 'POST', body: form });
      if (!response.ok) {
        throw new Error(`Cloudinary rejected the upload (${response.status}).`);
      }

      const result = (await response.json()) as {
        secure_url: string;
        public_id: string;
        bytes: number;
      };

      setPdf({ url: result.secure_url, publicId: result.public_id, sizeBytes: result.bytes });
      toast.success('PDF uploaded.');
    } catch (error) {
      toast.error(normaliseError(error).message);
    } finally {
      setIsUploadingPdf(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    if (!pdf) {
      setFormError('Upload the catalogue PDF before saving.');
      return;
    }

    if (!imagesHaveAltText(cover)) {
      setFormError('The cover image needs alt text before saving.');
      return;
    }

    try {
      await post('/admin/catalogue', {
        title: values.title,
        description: values.description || undefined,
        version: values.version,
        requiresLead: values.requiresLead,
        displayOrder: Number(values.displayOrder),
        file: pdf,
        coverImage: cover[0],
      });

      toast.success(`Uploaded '${values.title}'.`);
      await onSaved();
    } catch (caught) {
      setFormError(normaliseError(caught).message);
    }
  });

  return (
    <Modal
      isOpen
      onClose={onClose}
      variant="end"
      title="Upload catalogue"
      description="The first file you upload goes live automatically."
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            form="catalogue-form"
            disabled={isSubmitting || isUploadingPdf}
            className="btn btn-accent"
          >
            {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Save catalogue
          </button>
        </>
      }
    >
      <form id="catalogue-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id="title" label="Title" required error={errors.title?.message}>
          {(props) => <input {...props} {...register('title')} className="field-input" />}
        </FormField>

        <FormField
          id="version"
          label="Version"
          required
          hint="Shown next to the title on the download card, e.g. 2026-Q1."
          error={errors.version?.message}
        >
          {(props) => <input {...props} {...register('version')} className="field-input" />}
        </FormField>

        <FormField id="description" label="Description" error={errors.description?.message}>
          {(props) => (
            <textarea {...props} {...register('description')} rows={3} className="field-input" />
          )}
        </FormField>

        <div>
          <p className="field-label">
            Catalogue PDF
            <span className="ms-1 text-status-lost" aria-hidden>
              *
            </span>
          </p>

          <input
            ref={inputRef}
            id="pdf-upload"
            type="file"
            accept="application/pdf"
            onChange={(event) => void onPdfSelected(event.target.files?.[0])}
            disabled={isUploadingPdf}
            className="sr-only"
          />
          <label
            htmlFor="pdf-upload"
            className={`btn btn-ghost cursor-pointer ${isUploadingPdf ? 'pointer-events-none opacity-55' : ''}`}
          >
            {isUploadingPdf ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Upload aria-hidden className="size-4" />
            )}
            {isUploadingPdf ? 'Uploading…' : pdf ? 'Replace PDF' : 'Choose PDF'}
          </label>

          {pdf ? (
            <p className="mt-2 flex items-center gap-2 text-body-sm text-text-secondary">
              <FileText aria-hidden className="size-4" />
              <span data-tabular>{(pdf.sizeBytes / 1_048_576).toFixed(1)} MB uploaded</span>
            </p>
          ) : (
            <p className="mt-2 text-caption text-text-secondary">
              Compress before uploading — the download size is shown to visitors and counts against
              the monthly bandwidth allowance.
            </p>
          )}
        </div>

        <div>
          <p className="field-label">Cover image</p>
          <ImageUploader images={cover} onChange={setCover} folder="catalogue" max={1} />
        </div>

        <label className="flex items-start gap-2 text-body-sm">
          <input type="checkbox" {...register('requiresLead')} className="mt-1 size-4" />
          <span>
            Require the lead form before downloading
            <span className="block text-caption text-text-secondary">
              Turn this off and the button links straight to the file. No lead is captured.
            </span>
          </span>
        </label>

        <FormField id="displayOrder" label="Display order" error={errors.displayOrder?.message}>
          {(props) => (
            <input
              {...props}
              {...register('displayOrder')}
              type="number"
              min={0}
              className="field-input max-w-32"
            />
          )}
        </FormField>

        {formError ? (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] border border-status-lost/30 bg-status-lost/5 px-3 py-2 text-body-sm text-status-lost"
          >
            {formError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
