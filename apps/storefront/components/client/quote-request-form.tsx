'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { z } from 'zod';

import type { QuotationItemRejection, SubmitQuotationResponse } from '@isd/shared-types';
import { SAUDI_REGIONS } from '@isd/shared-types';

import { t } from '@/lib/i18n/en';
import { api, normaliseError } from '@/lib/api/client';
import { useCart } from '@/context/cart-context';
import { cloudinaryUrl, PLACEHOLDER_IMAGE } from '@/lib/cloudinary';

/**
 * Quotation request form (PROJECT_PLAN.md §9.9).
 *
 * The Zod schema mirrors the server DTO field for field. The server stays the
 * authority — this only saves a round trip and gives inline errors.
 */
const schema = z.object({
  name: z.string().min(2, 'Enter your full name.').max(120),
  designation: z.string().max(120).optional(),
  company: z.string().min(2, 'Enter your company name.').max(160),
  email: z.string().min(1, 'Enter your work email.').email('Enter a valid email address.'),
  phone: z.string().min(6, 'Enter a contact phone number.').max(40),

  line1: z.string().min(3, 'Enter the delivery address.').max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2, 'Enter a city.').max(120),
  region: z.enum(SAUDI_REGIONS, { message: 'Choose a region.' }),
  postalCode: z.string().max(20).optional(),

  message: z.string().max(4000).optional(),
  consent: z.literal(true, { message: 'Please confirm we may contact you.' }),
  /** Honeypot. Hidden from sighted users; a real visitor never fills it. */
  website: z.string().max(0).optional(),
});

type FormValues = z.input<typeof schema>;

export function QuoteRequestForm() {
  const router = useRouter();
  const { items, itemCount, isHydrated, removeItem, clearCart } = useCart();

  const [formError, setFormError] = useState<string | null>(null);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { region: 'Eastern Province' },
  });

  // An empty cart has nothing to submit; send them back rather than showing a
  // form that cannot succeed.
  useEffect(() => {
    if (isHydrated && items.length === 0) router.replace('/quote-cart');
  }, [isHydrated, items.length, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setRejectedIds([]);

    try {
      const response = await api.post<{ data: SubmitQuotationResponse }>('/quotations', {
        customer: {
          name: values.name,
          email: values.email,
          phone: values.phone,
          company: values.company,
          designation: values.designation || undefined,
        },
        address: {
          line1: values.line1,
          line2: values.line2 || undefined,
          city: values.city,
          region: values.region,
          postalCode: values.postalCode || undefined,
          country: 'Saudi Arabia',
        },
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          note: item.note,
        })),
        message: values.message || undefined,
        website: values.website || undefined,
      });

      const { quoteNumber } = response.data.data;

      // Cleared only after a confirmed success — losing a cart to a failed
      // submission would be unrecoverable for the customer.
      clearCart();
      router.push(`/quote-request/success/${encodeURIComponent(quoteNumber)}`);
    } catch (error) {
      const normalised = normaliseError(error);

      /**
       * 422 means one or more products were deleted or deactivated between
       * being added to the cart and submitting. The API names the offending
       * indexes; those lines are highlighted here and can be removed without
       * losing the rest of the request (§10).
       */
      if (normalised.status === 422) {
        const rejections = (
          error as { response?: { data?: { error?: { rejections?: QuotationItemRejection[] } } } }
        ).response?.data?.error?.rejections;

        const ids = rejections?.length
          ? rejections.map((rejection) => rejection.productId)
          : (normalised.details ?? [])
              .map((detail) => {
                const index = Number(/items\[(\d+)\]/.exec(detail.field ?? '')?.[1]);
                return Number.isFinite(index) ? items[index]?.productId : undefined;
              })
              .filter((id): id is string => Boolean(id));

        setRejectedIds(ids);
        setFormError(t.quote.unavailableLines);
        return;
      }

      setFormError(normalised.message);
    }
  });

  if (!isHydrated) {
    return <div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-surface-sunken" />;
  }

  return (
    <>
      <h1 className="font-display text-h1 font-bold text-surface-inverse">{t.quote.submit}</h1>
      <p className="prose-measure mt-2 text-body text-text-secondary">
        Tell us where to send the quotation and our team will come back with pricing and
        availability.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={onSubmit} noValidate className="space-y-8">
          <Fieldset legend={t.quote.yourDetails}>
            <Field id="name" label={t.quote.fields.name} required error={errors.name?.message}>
              <input id="name" autoComplete="name" {...register('name')} className="form-input" />
            </Field>

            <Field id="designation" label={t.quote.fields.designation}>
              <input
                id="designation"
                autoComplete="organization-title"
                {...register('designation')}
                className="form-input"
              />
            </Field>

            <Field
              id="company"
              label={t.quote.fields.company}
              required
              error={errors.company?.message}
            >
              <input
                id="company"
                autoComplete="organization"
                {...register('company')}
                className="form-input"
              />
            </Field>

            <Field id="email" label={t.quote.fields.email} required error={errors.email?.message}>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="form-input"
              />
            </Field>

            <Field id="phone" label={t.quote.fields.phone} required error={errors.phone?.message}>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                {...register('phone')}
                className="form-input"
              />
            </Field>
          </Fieldset>

          <Fieldset legend={t.quote.deliveryAddress}>
            <Field id="line1" label={t.quote.fields.line1} required error={errors.line1?.message}>
              <input
                id="line1"
                autoComplete="address-line1"
                {...register('line1')}
                className="form-input"
              />
            </Field>

            <Field id="line2" label={t.quote.fields.line2}>
              <input
                id="line2"
                autoComplete="address-line2"
                {...register('line2')}
                className="form-input"
              />
            </Field>

            <Field id="city" label={t.quote.fields.city} required error={errors.city?.message}>
              <input
                id="city"
                autoComplete="address-level2"
                {...register('city')}
                className="form-input"
              />
            </Field>

            <Field
              id="region"
              label={t.quote.fields.region}
              required
              error={errors.region?.message}
            >
              <select id="region" {...register('region')} className="form-input">
                {SAUDI_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="postalCode" label={t.quote.fields.postalCode}>
              <input
                id="postalCode"
                autoComplete="postal-code"
                {...register('postalCode')}
                className="form-input"
              />
            </Field>

            <Field id="country" label={t.quote.fields.country}>
              {/* Deliveries are Kingdom-wide only, so this is fixed. */}
              <input
                id="country"
                value="Saudi Arabia"
                readOnly
                className="form-input bg-surface-sunken"
              />
            </Field>
          </Fieldset>

          <Fieldset legend={t.quote.additionalRequirements} single>
            <Field id="message" label={t.quote.fields.message}>
              <textarea id="message" rows={4} {...register('message')} className="form-input" />
            </Field>
          </Fieldset>

          {/* Honeypot: hidden from sighted users and skipped by the tab order. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
          </div>

          <div>
            <label className="flex items-start gap-2 text-body-sm">
              <input type="checkbox" {...register('consent')} className="mt-1 size-4" />
              <span>{t.quote.consent}</span>
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
              className="flex items-start gap-2 rounded-[var(--radius-control)] border border-status-lost/30 bg-status-lost/5 px-3 py-2 text-body-sm text-status-lost"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {formError}
            </p>
          ) : null}

          {rejectedIds.length ? (
            <button
              type="button"
              onClick={() => {
                rejectedIds.forEach(removeItem);
                setRejectedIds([]);
                setFormError(null);
              }}
              className="btn-secondary"
            >
              {t.quote.removeUnavailable}
            </button>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full sm:w-auto">
            {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {isSubmitting ? t.quote.submitting : t.quote.submit}
          </button>
        </form>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[var(--radius-card)] border border-border-subtle">
            <h2 className="border-b border-border-subtle px-4 py-3 font-display text-h3 font-semibold text-surface-inverse">
              {t.quote.summary}
              <span className="ms-2 text-body-sm font-normal text-text-secondary" data-tabular>
                {t.cart.itemCount(itemCount)}
              </span>
            </h2>

            <ul className="max-h-[420px] divide-y divide-border-subtle overflow-y-auto">
              {items.map((item) => {
                const isRejected = rejectedIds.includes(item.productId);

                return (
                  <li
                    key={item.productId}
                    className={`flex gap-3 p-3 ${isRejected ? 'bg-status-lost/5' : ''}`}
                  >
                    <Image
                      src={
                        item.imageUrl
                          ? cloudinaryUrl(item.imageUrl, 'productThumb')
                          : PLACEHOLDER_IMAGE
                      }
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded border border-border-subtle bg-white object-contain"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-body-sm text-text-primary">{item.name}</p>
                      <p className="text-caption text-text-secondary" data-tabular>
                        {item.sku} · {item.quantity} {item.unit}
                      </p>
                      {isRejected ? (
                        <p className="text-caption font-semibold text-status-lost">
                          No longer available
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-border-subtle p-3">
              <Link
                href="/quote-cart"
                className="text-body-sm text-action-secondary hover:underline"
              >
                Edit request
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Fieldset({
  legend,
  children,
  single = false,
}: {
  legend: string;
  children: React.ReactNode;
  single?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-3 font-display text-h2 font-semibold text-surface-inverse">
        {legend}
      </legend>
      <div className={single ? 'space-y-4' : 'grid gap-4 sm:grid-cols-2'}>{children}</div>
    </fieldset>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-caption font-semibold text-text-secondary">
        {label}
        {required ? (
          <span className="ms-1 text-status-lost" aria-hidden>
            *
          </span>
        ) : (
          <span className="ms-1 font-normal text-text-muted">({t.quote.fields.optional})</span>
        )}
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
