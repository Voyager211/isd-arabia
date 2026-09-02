'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import type { AssetRef } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { cloudinaryUrl, PLACEHOLDER_IMAGE } from '@/lib/cloudinary';

/**
 * Product gallery (PROJECT_PLAN.md §9.4).
 *
 * A client component because of the thumbnail selection and the lightbox. The
 * main image still renders on the first pass with `priority`, so it is the LCP
 * element and does not wait for hydration.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: AssetRef[];
  productName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isLightboxOpen) return;

    lightboxRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLightboxOpen(false);
        triggerRef.current?.focus();
      }
      // Arrow keys step through the gallery, which is the expected behaviour
      // once a lightbox has focus.
      if (event.key === 'ArrowRight') setActiveIndex((index) => (index + 1) % images.length);
      if (event.key === 'ArrowLeft') {
        setActiveIndex((index) => (index - 1 + images.length) % images.length);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isLightboxOpen, images.length]);

  if (!images.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] border border-border-subtle bg-white">
        <Image
          src={PLACEHOLDER_IMAGE}
          alt={t.product.noImage}
          width={400}
          height={400}
          className="size-2/3 object-contain opacity-60"
        />
      </div>
    );
  }

  const active = images[activeIndex] ?? images[0];

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsLightboxOpen(true)}
        className="block w-full cursor-zoom-in overflow-hidden rounded-[var(--radius-card)] border border-border-subtle bg-white"
      >
        <Image
          src={cloudinaryUrl(active.url, 'productMain')}
          alt={active.alt || productName}
          width={800}
          height={800}
          priority
          sizes="(min-width: 1024px) 600px, 92vw"
          className="aspect-square w-full object-contain"
        />
      </button>

      {images.length > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <li key={image.publicId}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`${productName} — image ${index + 1} of ${images.length}`}
                aria-current={index === activeIndex}
                className={`block overflow-hidden rounded-[var(--radius-control)] border bg-white ${
                  index === activeIndex ? 'border-action-secondary' : 'border-border-subtle'
                }`}
              >
                <Image
                  src={cloudinaryUrl(image.url, 'productThumb')}
                  alt=""
                  width={80}
                  height={80}
                  className="size-20 object-contain"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {isLightboxOpen ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4">
          <div
            ref={lightboxRef}
            role="dialog"
            aria-modal="true"
            aria-label={productName}
            tabIndex={-1}
            className="relative max-h-full w-full max-w-3xl outline-none"
          >
            <button
              type="button"
              onClick={() => {
                setIsLightboxOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label={t.common.close}
              className="absolute -top-10 end-0 p-2 text-white"
            >
              <X aria-hidden className="size-6" />
            </button>

            <Image
              src={cloudinaryUrl(active.url, 'productMain')}
              alt={active.alt || productName}
              width={1200}
              height={1200}
              className="max-h-[80dvh] w-full rounded-[var(--radius-card)] bg-white object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
