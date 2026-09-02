import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

import { t } from '@/lib/i18n/en';
import { buildMetadata } from '@/lib/seo';
import { getBrands } from '@/lib/api/catalogue';
import { cloudinaryUrl } from '@/lib/cloudinary';

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  fallbackTitle: 'Brands',
  fallbackDescription:
    'The welding and MRO brands we supply across Saudi Arabia, including KASWELD, KASPRO, ESAB, MARKAL and AQUASOL.',
  path: '/brands',
});

export default async function BrandsPage() {
  const brands = await getBrands().catch(() => []);

  return (
    <div className="container-page py-12">
      <h1 className="font-display text-h1 font-bold text-surface-inverse">{t.nav.brands}</h1>
      <p className="prose-measure mt-2 text-body text-text-secondary">
        Every brand we stock, with the full product range behind each one.
      </p>

      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {brands.map((brand) => (
          <li key={brand._id}>
            <Link
              href={`/brands/${brand.slug}`}
              className="flex h-full flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-border-subtle bg-surface-page p-6 shadow-resting transition-colors hover:border-action-secondary"
            >
              {brand.logo ? (
                <Image
                  src={cloudinaryUrl(brand.logo.url, 'brandLogo')}
                  alt={brand.logo.alt || brand.name}
                  width={160}
                  height={80}
                  className="h-12 w-auto object-contain"
                />
              ) : null}
              <span className="text-center font-display text-h3 font-semibold text-surface-inverse">
                {brand.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
