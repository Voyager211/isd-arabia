import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import type { Category } from '@isd/shared-types';
import { MAX_CATEGORY_DEPTH } from '@isd/shared-types';

import { normaliseError, patch, post } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import { FormField } from '@/components/ui/form-field';
import { SeoAccordion, seoSchema } from '@/components/ui/seo-accordion';
import { slugify } from '@/lib/slugify';

/**
 * Category editor (PROJECT_PLAN.md §11.4).
 *
 * A slide-over rather than a route: the admin is almost always comparing the
 * category being edited against the tree behind it, and a full page navigation
 * loses that context on every edit.
 */

const schema = z.object({
  name: z.string().min(2, 'Enter a name of at least 2 characters.').max(120),
  slug: z
    .string()
    .max(160)
    .regex(/^[a-z0-9-]*$/, 'Use lowercase letters, numbers and hyphens only.')
    .optional(),
  description: z.string().max(2000).optional(),
  parent: z.string().optional(),
  displayOrder: z.coerce.number().int().min(0),
  showInMenu: z.boolean(),
  isActive: z.boolean(),
  seo: seoSchema,
});

type FormValues = z.input<typeof schema>;

interface CategoryOption {
  _id: string;
  name: string;
  level: number;
  ancestors: string[];
}

export function CategorySlideOver({
  category,
  allCategories,
  onClose,
  onSaved,
}: {
  category: Category | null;
  allCategories: CategoryOption[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = Boolean(category);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
      parent: category?.parent ?? '',
      displayOrder: category?.displayOrder ?? 0,
      showInMenu: category?.showInMenu ?? true,
      isActive: category?.isActive ?? true,
      seo: {
        metaTitle: category?.seo?.metaTitle ?? '',
        metaDescription: category?.seo?.metaDescription ?? '',
        metaKeywords: category?.seo?.metaKeywords?.join(', ') ?? '',
      },
    },
  });

  const name = watch('name');

  /**
   * The slug follows the name until the admin edits it by hand.
   *
   * Once a category is live its slug is an indexed URL, so an existing one is
   * never auto-regenerated on rename — changing it has to be a deliberate act.
   */
  const onNameBlur = () => {
    if (isEditing || dirtyFields.slug) return;
    if (name) setValue('slug', slugify(name), { shouldValidate: true });
  };

  /**
   * Valid parents exclude the category itself and its own descendants (a cycle
   * would detach the branch from the tree), and anything already at the
   * deepest level.
   */
  const parentOptions = allCategories.filter((option) => {
    if (option.level >= MAX_CATEGORY_DEPTH - 1) return false;
    if (!category) return true;
    if (option._id === category._id) return false;
    return !option.ancestors.includes(category._id);
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const payload = {
      name: values.name,
      slug: values.slug || undefined,
      description: values.description || undefined,
      parent: values.parent || null,
      displayOrder: Number(values.displayOrder),
      showInMenu: values.showInMenu,
      isActive: values.isActive,
      seo: {
        metaTitle: values.seo?.metaTitle || undefined,
        metaDescription: values.seo?.metaDescription || undefined,
        metaKeywords: values.seo?.metaKeywords
          ? values.seo.metaKeywords
              .split(',')
              .map((keyword) => keyword.trim())
              .filter(Boolean)
          : undefined,
      },
    };

    try {
      if (category) {
        await patch(`/admin/categories/${category._id}`, payload);
        toast.success(`Updated '${values.name}'.`);
      } else {
        await post('/admin/categories', payload);
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
      title={isEditing ? 'Edit category' : 'New category'}
      description={isEditing ? category?.slug : 'Leave the parent blank for a top-level category.'}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            form="category-form"
            disabled={isSubmitting}
            className="btn btn-accent"
          >
            {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : 'Create category'}
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField id="name" label="Name" required error={errors.name?.message}>
          {(props) => (
            <input {...props} {...register('name')} onBlur={onNameBlur} className="field-input" />
          )}
        </FormField>

        <FormField
          id="slug"
          label="URL slug"
          hint="Generated from the name. Changing it after launch breaks existing links."
          error={errors.slug?.message}
        >
          {(props) => <input {...props} {...register('slug')} className="field-input" />}
        </FormField>

        <FormField id="parent" label="Parent category" error={errors.parent?.message}>
          {(props) => (
            <select {...props} {...register('parent')} className="field-input">
              <option value="">— Top level —</option>
              {parentOptions.map((option) => (
                <option key={option._id} value={option._id}>
                  {'— '.repeat(option.level)}
                  {option.name}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField id="description" label="Description" error={errors.description?.message}>
          {(props) => (
            <textarea {...props} {...register('description')} rows={3} className="field-input" />
          )}
        </FormField>

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

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-body-sm">
            <input type="checkbox" {...register('showInMenu')} className="size-4" />
            Show in the mega-menu
          </label>
          <label className="flex items-center gap-2 text-body-sm">
            <input type="checkbox" {...register('isActive')} className="size-4" />
            Active on the storefront
          </label>
        </div>

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
