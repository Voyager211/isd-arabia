import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import type { AssetRef, Brand, Industry } from '@isd/shared-types';

import { normaliseError, patch, post } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import { FormField } from '@/components/ui/form-field';
import { SeoAccordion, seoSchema } from '@/components/ui/seo-accordion';
import { ImageUploader, imagesHaveAltText } from '@/components/ui/image-uploader';
import { slugify } from '@/lib/slugify';

export type TaxonomyKind = 'brand' | 'industry';

const schema = z.object({
  name: z.string().min(2, 'Enter a name of at least 2 characters.').max(120),
  slug: z
    .string()
    .max(160)
    .regex(/^[a-z0-9-]*$/, 'Use lowercase letters, numbers and hyphens only.')
    .optional(),
  description: z.string().max(2000).optional(),
  content: z.string().max(50_000).optional(),
  displayOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
  seo: seoSchema,
});

type FormValues = z.input<typeof schema>;

const ENDPOINTS: Record<TaxonomyKind, string> = {
  brand: '/admin/brands',
  industry: '/admin/industries',
};

/**
 * Editor for a brand or an industry.
 *
 * The only real differences: a brand has a logo where an industry has an icon,
 * and an industry carries long-form content for its landing page. Everything
 * else — slug behaviour, banner, ordering, SEO — is identical, which is why
 * one component serves both.
 */
export function TaxonomySlideOver({
  kind,
  record,
  onClose,
  onSaved,
}: {
  kind: TaxonomyKind;
  record: Brand | Industry | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const isEditing = Boolean(record);
  const isBrand = kind === 'brand';

  const existingMark = isBrand ? (record as Brand | null)?.logo : (record as Industry | null)?.icon;

  const [mark, setMark] = useState<AssetRef[]>(existingMark ? [existingMark] : []);
  const [banner, setBanner] = useState<AssetRef[]>(record?.banner ? [record.banner] : []);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: record?.name ?? '',
      slug: record?.slug ?? '',
      description: record?.description ?? '',
      content: (record as Industry | null)?.content ?? '',
      displayOrder: record?.displayOrder ?? 0,
      isActive: record?.isActive ?? true,
      seo: {
        metaTitle: record?.seo?.metaTitle ?? '',
        metaDescription: record?.seo?.metaDescription ?? '',
        metaKeywords: record?.seo?.metaKeywords?.join(', ') ?? '',
      },
    },
  });

  const name = watch('name');

  const onNameBlur = () => {
    if (isEditing || dirtyFields.slug) return;
    if (name) setValue('slug', slugify(name), { shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    // Alt text is required on every image (§5.5) and is checked before the
    // request rather than after a 400 comes back.
    if (!imagesHaveAltText([...mark, ...banner])) {
      setFormError('Every image needs alt text before saving.');
      return;
    }

    const payload = {
      name: values.name,
      slug: values.slug || undefined,
      description: values.description || undefined,
      displayOrder: Number(values.displayOrder),
      isActive: values.isActive,
      ...(isBrand ? { logo: mark[0] } : { icon: mark[0], content: values.content || undefined }),
      banner: banner[0],
      seo: {
        metaTitle: values.seo?.metaTitle || undefined,
        metaDescription: values.seo?.metaDescription || undefined,
        metaKeywords: values.seo?.metaKeywords
          ? values.seo.metaKeywords
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean)
          : undefined,
      },
    };

    try {
      if (record) {
        await patch(`${ENDPOINTS[kind]}/${record._id}`, payload);
        toast.success(`Updated '${values.name}'.`);
      } else {
        await post(ENDPOINTS[kind], payload);
        toast.success(`Created '${values.name}'.`);
      }
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
      title={`${isEditing ? 'Edit' : 'New'} ${kind}`}
      description={isEditing ? record?.slug : undefined}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            form="taxonomy-form"
            disabled={isSubmitting}
            className="btn btn-accent"
          >
            {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : `Create ${kind}`}
          </button>
        </>
      }
    >
      <form id="taxonomy-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id="name" label="Name" required error={errors.name?.message}>
          {(props) => (
            <input {...props} {...register('name')} onBlur={onNameBlur} className="field-input" />
          )}
        </FormField>

        <FormField id="slug" label="URL slug" error={errors.slug?.message}>
          {(props) => <input {...props} {...register('slug')} className="field-input" />}
        </FormField>

        <FormField id="description" label="Short description" error={errors.description?.message}>
          {(props) => (
            <textarea {...props} {...register('description')} rows={3} className="field-input" />
          )}
        </FormField>

        {!isBrand ? (
          <FormField
            id="content"
            label="Landing page content"
            hint="Long-form copy for the industry page. HTML is sanitised on save."
            error={errors.content?.message}
          >
            {(props) => (
              <textarea {...props} {...register('content')} rows={8} className="field-input" />
            )}
          </FormField>
        ) : null}

        <div>
          <p className="field-label">{isBrand ? 'Logo' : 'Icon'}</p>
          <ImageUploader
            images={mark}
            onChange={setMark}
            folder={isBrand ? 'brands' : 'industries'}
            max={1}
          />
        </div>

        <div>
          <p className="field-label">Banner</p>
          <ImageUploader images={banner} onChange={setBanner} folder="banners" max={1} />
        </div>

        <FormField id="displayOrder" label="Display order" error={errors.displayOrder?.message}>
          {(props) => (
            <input
              {...props}
              {...register('displayOrder')}
              type="number"
              min={0}
              className="field-input"
            />
          )}
        </FormField>

        <label className="flex items-center gap-2 text-body-sm">
          <input type="checkbox" {...register('isActive')} className="size-4" />
          Active on the storefront
        </label>

        <SeoAccordion register={register} errors={errors} />

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
