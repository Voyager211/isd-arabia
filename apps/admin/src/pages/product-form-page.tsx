import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import type {
  AssetRef,
  Brand,
  CategoryNode,
  Industry,
  ProductSpecification,
} from '@isd/shared-types';
import { PRODUCT_AVAILABILITY, PRODUCT_UNITS } from '@isd/shared-types';

import { get, normaliseError, patch, post } from '@/lib/api-client';
import { useAsyncData } from '@/hooks/use-async-data';
import { flattenCategories } from '@/lib/categories';
import { slugify } from '@/lib/slugify';
import { PageHeader } from '@/components/ui/page-header';
import { FormField } from '@/components/ui/form-field';
import { SeoAccordion, seoSchema } from '@/components/ui/seo-accordion';
import { ImageUploader, imagesHaveAltText } from '@/components/ui/image-uploader';
import { RepeatableList } from '@/components/ui/repeatable-list';
import { SpecList } from '@/components/ui/spec-list';

/**
 * Product create/edit (PROJECT_PLAN.md §11.5).
 *
 * This is the highest-usage screen in the whole build: the client enters the
 * entire catalogue through it by hand, at roughly four minutes per product.
 * Three things follow from that, and none of them is decoration:
 *
 *   • **Save and add another** returns a clean form with the category and
 *     brand retained. Entering a category's worth of products in one sitting
 *     is the normal case, and re-selecting the same two fields several hundred
 *     times is hours of the client's life.
 *   • **Ctrl/Cmd+S saves.** Hands stay on the keyboard.
 *   • **An unsaved-changes guard**, because losing a half-entered product with
 *     five uploaded images to a stray back-navigation is unrecoverable.
 *
 * A full page, not a slide-over — there are nine sections and a slide-over
 * would spend the whole time scrolled.
 */

const schema = z.object({
  name: z.string().min(2, 'Enter a product name.').max(250),
  slug: z
    .string()
    .max(300)
    .regex(/^[a-z0-9-]*$/, 'Use lowercase letters, numbers and hyphens only.')
    .optional(),
  sku: z.string().min(1, 'Enter a part number.').max(80),
  shortDescription: z.string().max(300, 'Keep this under 300 characters.').optional(),
  description: z.string().max(50_000).optional(),
  category: z.string().min(1, 'Choose a category.'),
  brand: z.string().optional(),
  unit: z.enum(PRODUCT_UNITS),
  minOrderQuantity: z.coerce.number().int().min(1),
  availability: z.enum(PRODUCT_AVAILABILITY),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  isNewArrival: z.boolean(),
  displayOrder: z.coerce.number().int().min(0),
  seo: seoSchema,
});

type FormValues = z.input<typeof schema>;

interface ProductRecord extends Omit<FormValues, 'seo' | 'brand'> {
  _id: string;
  brand?: string | null;
  industries?: string[];
  images?: AssetRef[];
  keyFeatures?: string[];
  specifications?: ProductSpecification[];
  seo?: { metaTitle?: string; metaDescription?: string; metaKeywords?: string[] };
}

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id && id !== 'new');

  const { data: categories } = useAsyncData<CategoryNode[]>('/admin/categories');
  const { data: brands } = useAsyncData<Brand[]>('/admin/brands');
  const { data: industries } = useAsyncData<Industry[]>('/admin/industries');

  const [images, setImages] = useState<AssetRef[]>([]);
  const [keyFeatures, setKeyFeatures] = useState<string[]>([]);
  const [specifications, setSpecifications] = useState<ProductSpecification[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      sku: '',
      shortDescription: '',
      description: '',
      category: '',
      brand: '',
      unit: 'piece',
      minOrderQuantity: 1,
      availability: 'on_request',
      isActive: true,
      isFeatured: false,
      isNewArrival: false,
      displayOrder: 0,
      seo: { metaTitle: '', metaDescription: '', metaKeywords: '' },
    },
  });

  // Load the existing record.
  useEffect(() => {
    if (!isEditing || !id) return;

    let cancelled = false;

    void (async () => {
      try {
        const product = await get<ProductRecord>(`/admin/products/${id}`);
        if (cancelled) return;

        reset({
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          shortDescription: product.shortDescription ?? '',
          description: product.description ?? '',
          category: String(product.category ?? ''),
          brand: product.brand ? String(product.brand) : '',
          unit: product.unit,
          minOrderQuantity: product.minOrderQuantity,
          availability: product.availability,
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          isNewArrival: product.isNewArrival,
          displayOrder: product.displayOrder,
          seo: {
            metaTitle: product.seo?.metaTitle ?? '',
            metaDescription: product.seo?.metaDescription ?? '',
            metaKeywords: product.seo?.metaKeywords?.join(', ') ?? '',
          },
        });

        setImages(product.images ?? []);
        setKeyFeatures(product.keyFeatures ?? []);
        setSpecifications(product.specifications ?? []);
        setSelectedIndustries((product.industries ?? []).map(String));
      } catch (caught) {
        if (!cancelled) setFormError(normaliseError(caught).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isEditing, reset]);

  /**
   * Unsaved-changes guard.
   *
   * `beforeunload` covers a closed tab or a typed URL. In-app navigation is
   * covered by the confirm in `onCancel` — React Router v7 has no blocker in
   * the declarative API, and a half-entered product with five uploaded images
   * is not something to lose to a stray click.
   */
  const hasUnsavedWork =
    isDirty || images.length > 0 || keyFeatures.length > 0 || specifications.length > 0;

  useEffect(() => {
    if (!hasUnsavedWork) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedWork]);

  const name = watch('name');

  const onNameBlur = () => {
    if (isEditing || dirtyFields.slug) return;
    if (name) setValue('slug', slugify(name), { shouldValidate: true });
  };

  const buildPayload = (values: FormValues) => ({
    name: values.name,
    slug: values.slug || undefined,
    sku: values.sku,
    shortDescription: values.shortDescription || undefined,
    description: values.description || undefined,
    category: values.category,
    brand: values.brand || null,
    industries: selectedIndustries,
    unit: values.unit,
    minOrderQuantity: Number(values.minOrderQuantity),
    availability: values.availability,
    isActive: values.isActive,
    isFeatured: values.isFeatured,
    isNewArrival: values.isNewArrival,
    displayOrder: Number(values.displayOrder),
    images,
    keyFeatures: keyFeatures.filter((feature) => feature.trim()),
    specifications: specifications.filter((spec) => spec.label.trim() && spec.value.trim()),
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
  });

  const save = async (values: FormValues, thenAddAnother: boolean) => {
    setFormError(null);

    // Alt text is mandatory on every image (§5.5), checked before the request.
    if (!imagesHaveAltText(images)) {
      setFormError('Every image needs alt text before saving.');
      return;
    }

    try {
      if (isEditing && id) {
        await patch(`/admin/products/${id}`, buildPayload(values));
        toast.success(`Saved '${values.name}'.`);
        return;
      }

      await post('/admin/products', buildPayload(values));
      toast.success(`Created '${values.name}'.`);

      if (thenAddAnother) {
        // The retained category and brand are the whole point: entering a
        // category's worth of products in one sitting is the normal case.
        const { category, brand, unit, availability } = getValues();
        reset({
          name: '',
          slug: '',
          sku: '',
          shortDescription: '',
          description: '',
          category,
          brand,
          unit,
          minOrderQuantity: 1,
          availability,
          isActive: true,
          isFeatured: false,
          isNewArrival: false,
          displayOrder: 0,
          seo: { metaTitle: '', metaDescription: '', metaKeywords: '' },
        });
        setImages([]);
        setKeyFeatures([]);
        setSpecifications([]);
        window.scrollTo({ top: 0 });
        return;
      }

      navigate('/products');
    } catch (caught) {
      setFormError(normaliseError(caught).message);
    }
  };

  const onSubmit = handleSubmit((values) => save(values, false));
  const onSubmitAndAdd = handleSubmit((values) => save(values, true));

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void onSubmit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSubmit]);

  const onCancel = () => {
    if (hasUnsavedWork && !window.confirm('Discard unsaved changes?')) return;
    navigate('/products');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-16 text-text-secondary">
        <Loader2 aria-hidden className="size-5 animate-spin" />
        Loading product…
      </div>
    );
  }

  const leafCategories = flattenCategories(categories ?? []);

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        title={isEditing ? 'Edit product' : 'New product'}
        description="Ctrl+S saves. Products can only be filed against a category with no subcategories."
        actions={
          <>
            <button type="button" onClick={onCancel} className="btn btn-ghost">
              Cancel
            </button>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => void onSubmitAndAdd()}
                disabled={isSubmitting}
                className="btn btn-ghost"
              >
                Save and add another
              </button>
            ) : null}
            <button type="submit" disabled={isSubmitting} className="btn btn-accent">
              {isSubmitting ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Save aria-hidden className="size-4" />
              )}
              Save
            </button>
          </>
        }
      />

      <div className="space-y-4">
        <Section title="Basic">
          <FormField id="name" label="Product name" required error={errors.name?.message}>
            {(props) => (
              <input {...props} {...register('name')} onBlur={onNameBlur} className="field-input" />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="sku" label="Part number" required error={errors.sku?.message}>
              {(props) => (
                <input {...props} {...register('sku')} className="field-input uppercase" />
              )}
            </FormField>

            <FormField id="slug" label="URL slug" error={errors.slug?.message}>
              {(props) => <input {...props} {...register('slug')} className="field-input" />}
            </FormField>
          </div>

          <FormField
            id="shortDescription"
            label="Short description"
            hint="Shown on cards and used as the meta description fallback. Max 300 characters."
            error={errors.shortDescription?.message}
          >
            {(props) => (
              <textarea
                {...props}
                {...register('shortDescription')}
                rows={2}
                className="field-input"
              />
            )}
          </FormField>
        </Section>

        <Section title="Description">
          <FormField
            id="description"
            label="Full description"
            hint="Basic HTML is allowed and is sanitised on save."
            error={errors.description?.message}
          >
            {(props) => (
              <textarea {...props} {...register('description')} rows={8} className="field-input" />
            )}
          </FormField>
        </Section>

        <Section title="Key features">
          <RepeatableList
            label="Feature"
            values={keyFeatures}
            onChange={setKeyFeatures}
            placeholder="Air-cooled, rated to 200A"
          />
        </Section>

        <Section title="Specifications">
          <SpecList values={specifications} onChange={setSpecifications} />
        </Section>

        <Section title="Images">
          <ImageUploader images={images} onChange={setImages} folder="products" productId={id} />
        </Section>

        <Section title="Classification">
          <FormField
            id="category"
            label="Category"
            required
            hint="Only categories with no subcategories are listed."
            error={errors.category?.message}
          >
            {(props) => (
              <select {...props} {...register('category')} className="field-input">
                <option value="">— Choose a category —</option>
                {leafCategories.map((option) => (
                  <option key={option._id} value={option._id}>
                    {option.path}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField id="brand" label="Brand" error={errors.brand?.message}>
            {(props) => (
              <select {...props} {...register('brand')} className="field-input">
                <option value="">— No brand —</option>
                {(brands ?? []).map((option) => (
                  <option key={option._id} value={option._id}>
                    {option.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <fieldset>
            <legend className="field-label">Industries</legend>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {(industries ?? []).map((industry) => (
                <label key={industry._id} className="flex items-center gap-2 text-body-sm">
                  <input
                    type="checkbox"
                    checked={selectedIndustries.includes(industry._id)}
                    onChange={(event) =>
                      setSelectedIndustries((current) =>
                        event.target.checked
                          ? [...current, industry._id]
                          : current.filter((entry) => entry !== industry._id),
                      )
                    }
                    className="size-4"
                  />
                  {industry.name}
                </label>
              ))}
            </div>
          </fieldset>
        </Section>

        <Section title="Details">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="unit" label="Unit" error={errors.unit?.message}>
              {(props) => (
                <select {...props} {...register('unit')} className="field-input">
                  {PRODUCT_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="minOrderQuantity"
              label="Minimum order"
              error={errors.minOrderQuantity?.message}
            >
              {(props) => (
                <input
                  {...props}
                  {...register('minOrderQuantity')}
                  type="number"
                  min={1}
                  className="field-input"
                />
              )}
            </FormField>

            <FormField id="availability" label="Availability" error={errors.availability?.message}>
              {(props) => (
                <select {...props} {...register('availability')} className="field-input">
                  {PRODUCT_AVAILABILITY.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>
        </Section>

        <Section title="Visibility">
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-body-sm">
              <input type="checkbox" {...register('isActive')} className="size-4" />
              Active on the storefront
            </label>
            <label className="flex items-center gap-2 text-body-sm">
              <input type="checkbox" {...register('isFeatured')} className="size-4" />
              Featured
            </label>
            <label className="flex items-center gap-2 text-body-sm">
              <input type="checkbox" {...register('isNewArrival')} className="size-4" />
              New arrival
            </label>
          </div>

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
        </Section>

        <Section title="Search engine listing">
          <SeoAccordion register={register} errors={errors} />
        </Section>

        {formError ? (
          <p
            role="alert"
            aria-live="assertive"
            className="rounded-[var(--radius-control)] border border-status-lost/30 bg-status-lost/5 px-3 py-2 text-body-sm text-status-lost"
          >
            {formError}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-4">
      <h2 className="mb-3 font-display text-h3 font-semibold text-surface-inverse">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
