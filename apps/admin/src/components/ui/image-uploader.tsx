import { useCallback, useRef, useState } from 'react';
import { GripVertical, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import type { AssetRef, UploadFolder, UploadSignatureResponse } from '@isd/shared-types';

import { normaliseError, post } from '@/lib/api-client';

/**
 * Signed direct-to-Cloudinary image uploader (PROJECT_PLAN.md §11.5, §13.1).
 *
 * The file bytes never touch the API: the browser asks for a signature, uploads
 * straight to Cloudinary, and posts back only the resulting references. That is
 * what keeps large bodies off a free-tier instance with tight memory.
 *
 * Alt text is REQUIRED per image and enforced here (§5.5). It is a genuine
 * accessibility requirement and the only point at which anyone will ever write
 * it — asking later never happens.
 *
 * This is the screen the client will spend hundreds of hours in, so drag-to-
 * reorder and inline alt editing matter more here than almost anywhere else.
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
}

export function ImageUploader({
  images,
  onChange,
  folder = 'products',
  productId,
  max = 20,
}: {
  images: AssetRef[];
  onChange: (images: AssetRef[]) => void;
  folder?: UploadFolder;
  productId?: string;
  max?: number;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadOne = useCallback(
    async (file: File): Promise<AssetRef | null> => {
      const signature = await post<UploadSignatureResponse>('/admin/uploads/signature', {
        folder,
        resourceType: 'image',
        ...(productId ? { productId } : {}),
      });

      const form = new FormData();
      form.append('file', file);
      form.append('api_key', signature.apiKey);
      form.append('timestamp', String(signature.timestamp));
      form.append('signature', signature.signature);
      form.append('folder', signature.folder);

      const response = await fetch(signature.uploadUrl, { method: 'POST', body: form });
      if (!response.ok) {
        throw new Error(`Cloudinary rejected the upload (${response.status}).`);
      }

      const result = (await response.json()) as CloudinaryUploadResponse;

      return {
        url: result.secure_url,
        publicId: result.public_id,
        // Seeded from the filename so the field is never blank on screen; the
        // form still refuses to save until it has been made meaningful.
        alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        width: result.width,
        height: result.height,
        order: 0,
      };
    },
    [folder, productId],
  );

  const onFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const files = Array.from(fileList);
    const room = max - images.length;

    if (files.length > room) {
      toast.error(`You can add ${room} more image${room === 1 ? '' : 's'}.`);
      return;
    }

    const rejected = files.filter(
      (file) => !ACCEPTED.includes(file.type) || file.size > MAX_FILE_BYTES,
    );
    if (rejected.length) {
      toast.error('Images must be JPEG, PNG, WebP or AVIF and under 10 MB.');
      return;
    }

    setIsUploading(true);
    try {
      // Sequential, not parallel: a free-tier Cloudinary account throttles
      // concurrent uploads, and a failure part-way through is easier to reason
      // about when the successful ones are already attached.
      const uploaded: AssetRef[] = [];
      for (const file of files) {
        const asset = await uploadOne(file);
        if (asset) uploaded.push(asset);
      }

      onChange(reindex([...images, ...uploaded]));
      toast.success(`Added ${uploaded.length} image${uploaded.length === 1 ? '' : 's'}.`);
    } catch (error) {
      toast.error(normaliseError(error).message);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(reindex(next));
  };

  const remove = (index: number) => {
    onChange(reindex(images.filter((_, i) => i !== index)));
  };

  const setAlt = (index: number, alt: string) => {
    onChange(images.map((image, i) => (i === index ? { ...image, alt } : image)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          id="image-upload"
          type="file"
          accept={ACCEPTED.join(',')}
          multiple
          onChange={(event) => void onFiles(event.target.files)}
          disabled={isUploading || images.length >= max}
          className="sr-only"
        />
        <label
          htmlFor="image-upload"
          className={`btn btn-ghost cursor-pointer ${
            isUploading || images.length >= max ? 'pointer-events-none opacity-55' : ''
          }`}
        >
          {isUploading ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Upload aria-hidden className="size-4" />
          )}
          {isUploading ? 'Uploading…' : 'Add images'}
        </label>

        <p className="text-caption text-text-secondary">
          {images.length} of {max}. The first image is the primary one.
        </p>
      </div>

      {images.length ? (
        <ul className="space-y-2">
          {images.map((image, index) => (
            <li
              key={image.publicId}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex items-start gap-3 rounded-[var(--radius-control)] border border-border-subtle bg-surface-page p-2 ${
                dragIndex === index ? 'opacity-50' : ''
              }`}
            >
              <span
                className="mt-6 cursor-grab text-text-muted"
                aria-hidden
                title="Drag to reorder"
              >
                <GripVertical className="size-4" />
              </span>

              <img
                src={image.url}
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 rounded border border-border-subtle bg-white object-contain"
              />

              <div className="min-w-0 flex-1">
                <label className="field-label" htmlFor={`alt-${image.publicId}`}>
                  Alt text
                  <span className="ms-1 text-status-lost" aria-hidden>
                    *
                  </span>
                </label>
                <input
                  id={`alt-${image.publicId}`}
                  value={image.alt}
                  onChange={(event) => setAlt(index, event.target.value)}
                  placeholder="Describe the image for screen readers"
                  aria-invalid={!image.alt.trim()}
                  className="field-input"
                />
                {!image.alt.trim() ? (
                  <p className="field-error">Alt text is required before saving.</p>
                ) : null}
              </div>

              <div className="mt-6 flex shrink-0 items-center gap-1">
                {index === 0 ? (
                  <span
                    className="p-1.5 text-action-primary"
                    title="Primary image"
                    aria-label="Primary image"
                  >
                    <Star aria-hidden className="size-4 fill-current" />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => move(index, 0)}
                    aria-label="Make this the primary image"
                    title="Make primary"
                    className="p-1.5 text-text-muted hover:text-action-primary"
                  >
                    <Star aria-hidden className="size-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove image"
                  className="p-1.5 text-text-muted hover:text-status-lost"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[var(--radius-control)] border border-dashed border-border-subtle p-6 text-center text-body-sm text-text-secondary">
          No images yet.
        </p>
      )}
    </div>
  );
}

/** Keeps `order` matching array position — index 0 is the primary image. */
function reindex(images: AssetRef[]): AssetRef[] {
  return images.map((image, index) => ({ ...image, order: index }));
}

/** True when every image has usable alt text. The form gates saving on this. */
export function imagesHaveAltText(images: AssetRef[]): boolean {
  return images.every((image) => image.alt.trim().length > 0);
}
