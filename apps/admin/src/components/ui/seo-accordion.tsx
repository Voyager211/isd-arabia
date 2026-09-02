import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from './form-field';

/**
 * The SEO section shared by every entity form (PROJECT_PLAN.md §11.4, §11.5).
 *
 * Collapsed by default. The client will fill these in for maybe a dozen
 * important pages and leave the rest to the fallbacks in the storefront's
 * `buildMetadata`, so it should not be in the way of the fields they type on
 * every single record.
 *
 * The length limits are the ones search engines actually render — over them,
 * the text is truncated rather than ignored, so the counter is a real
 * constraint and not a style preference.
 */

export const seoSchema = z
  .object({
    metaTitle: z.string().max(60, 'Keep the title under 60 characters.').optional(),
    metaDescription: z.string().max(160, 'Keep the description under 160 characters.').optional(),
    metaKeywords: z.string().max(500).optional(),
  })
  .optional();

/**
 * This component is embedded in five forms whose value shapes differ in every
 * field except `seo`, so the props describe only what it actually uses rather
 * than threading each parent's generic through.
 *
 * `UseFormRegister<any>` would NOT work here: `register` is contravariant in
 * its field-name parameter, so a concrete `UseFormRegister<FormValues>` is not
 * assignable to it. Naming just the three paths this component registers makes
 * the parameter type wider at the source than the target, which is assignable —
 * and it also stops a typo'd path compiling.
 */
type SeoField = 'seo.metaTitle' | 'seo.metaDescription' | 'seo.metaKeywords';
type SeoRegister = (name: SeoField) => UseFormRegisterReturn;

interface SeoErrors {
  seo?: {
    metaTitle?: { message?: string };
    metaDescription?: { message?: string };
    metaKeywords?: { message?: string };
  };
}

export function SeoAccordion({ register, errors }: { register: SeoRegister; errors: SeoErrors }) {
  const [isOpen, setIsOpen] = useState(false);
  const seoErrors = errors.seo;

  return (
    <div className="rounded-[var(--radius-control)] border border-border-subtle">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between px-3 py-2.5 text-body-sm font-semibold text-text-primary"
      >
        Search engine listing
        <ChevronDown
          aria-hidden
          className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen ? (
        <div className="space-y-3 border-t border-border-subtle p-3">
          <FormField
            id="seo-title"
            label="Meta title"
            hint="Max 60 characters. Falls back to the record's name."
            error={seoErrors?.metaTitle?.message}
          >
            {(props) => <input {...props} {...register('seo.metaTitle')} className="field-input" />}
          </FormField>

          <FormField
            id="seo-description"
            label="Meta description"
            hint="Max 160 characters. Falls back to the short description."
            error={seoErrors?.metaDescription?.message}
          >
            {(props) => (
              <textarea
                {...props}
                {...register('seo.metaDescription')}
                rows={2}
                className="field-input"
              />
            )}
          </FormField>

          <FormField id="seo-keywords" label="Keywords" hint="Comma separated.">
            {(props) => (
              <input {...props} {...register('seo.metaKeywords')} className="field-input" />
            )}
          </FormField>
        </div>
      ) : null}
    </div>
  );
}
