import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE } from '@isd/shared-types';

import { normaliseError } from '@/lib/api-client';
import { useAuth } from '@/context/auth-context';

/**
 * Forced first-use password change (PROJECT_PLAN.md §12.1, acceptance #16).
 *
 * The seeded credential is documented and predictable, which is fine for local
 * and staging and would be indefensible on a live admin panel. This screen —
 * plus the server-side guard that blocks every other route until it is done —
 * is what makes shipping that default safe.
 *
 * The Zod schema mirrors `checkPasswordPolicy` on the server exactly. The
 * server remains the authority; this just fails fast without a round trip.
 */

const SEEDED_DEFAULT_PASSWORD = '@Password123';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE)
      .regex(/[a-z]/, PASSWORD_POLICY_MESSAGE)
      .regex(/[A-Z]/, PASSWORD_POLICY_MESSAGE)
      .regex(/\d/, PASSWORD_POLICY_MESSAGE)
      .regex(/[^A-Za-z0-9]/, PASSWORD_POLICY_MESSAGE)
      .refine(
        (value) => value !== SEEDED_DEFAULT_PASSWORD,
        'Choose a password other than the default seeded credential.',
      ),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    message: 'The new password must be different from the current one.',
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match.',
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordPage() {
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(normaliseError(error).message);
    }
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-sunken p-4">
      <div className="panel w-full max-w-md p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-status-review" />
          <div>
            <h1 className="font-display text-h2 font-bold text-surface-inverse">
              Choose a new password
            </h1>
            <p className="mt-1 text-body-sm text-text-secondary">
              {user?.email} is still on the default credential. Set a new password to continue — no
              other screen is reachable until you do.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <div>
            <label className="field-label" htmlFor="currentPassword">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              autoFocus
              className="field-input"
              aria-invalid={Boolean(errors.currentPassword)}
              aria-describedby={errors.currentPassword ? 'currentPassword-error' : undefined}
              {...register('currentPassword')}
            />
            {errors.currentPassword ? (
              <p id="currentPassword-error" className="field-error">
                {errors.currentPassword.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="field-label" htmlFor="newPassword">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className="field-input"
              aria-invalid={Boolean(errors.newPassword)}
              aria-describedby="newPassword-hint newPassword-error"
              {...register('newPassword')}
            />
            <p id="newPassword-hint" className="mt-1 text-caption text-text-secondary">
              {PASSWORD_POLICY_MESSAGE}
            </p>
            {errors.newPassword ? (
              <p id="newPassword-error" className="field-error">
                {errors.newPassword.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="field-label" htmlFor="confirmPassword">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="field-input"
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword ? (
              <p id="confirmPassword-error" className="field-error">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p
              role="alert"
              aria-live="assertive"
              className="rounded-[var(--radius-control)] border border-status-lost/30 bg-status-lost/5 px-3 py-2 text-body-sm text-status-lost"
            >
              {formError}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="btn btn-accent w-full">
            {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {isSubmitting ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}
