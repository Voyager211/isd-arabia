import Link from 'next/link';
import type { Metadata } from 'next';

import { t } from '@/lib/i18n/en';
import { buildMetadata } from '@/lib/seo';
import { getIndustries } from '@/lib/api/catalogue';

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  fallbackTitle: 'Industries we supply',
  fallbackDescription:
    'Welding and MRO supply for steel construction, pipelines, oil and gas, petrochemical, shipbuilding, power generation and more.',
  path: '/industries',
});

export default async function IndustriesPage() {
  const industries = await getIndustries().catch(() => []);

  return (
    <div className="container-page py-12">
      <h1 className="font-display text-h1 font-bold text-surface-inverse">{t.nav.industries}</h1>
      <p className="prose-measure mt-2 text-body text-text-secondary">
        The sectors we supply, and the consumables each one runs on.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {industries.map((industry) => (
          <li key={industry._id}>
            <Link
              href={`/industries/${industry.slug}`}
              className="flex h-full flex-col rounded-[var(--radius-card)] border border-border-subtle bg-surface-page p-5 shadow-resting transition-colors hover:border-action-secondary"
            >
              <span className="font-display text-h3 font-semibold text-surface-inverse">
                {industry.name}
              </span>
              {industry.description ? (
                <span className="mt-2 text-body-sm text-text-secondary">
                  {industry.description}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
