import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import { normaliseError } from '@/lib/api-client';
import { useAuth } from '@/context/auth-context';

/**
 * Admin sign-in (PROJECT_PLAN.md §11.2).
 *
 * Rate limited server-side to 5 attempts per 15 minutes per IP. The error
 * shown is whatever the API returns, which is deliberately generic — it never
 * distinguishes "no such user" from "wrong password", because a form that does
 * is an account-enumeration oracle.
 */

const schema = z.object({
  email: z.string().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await login(values.email, values.password);
      navigate(result.mustChangePassword ? '/change-password' : '/', { replace: true });
    } catch (error) {
      setFormError(normaliseError(error).message);
    }
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-sunken p-4">
      <div className="panel w-full max-w-sm p-6">
        <h1 className="font-display text-h2 font-bold text-surface-inverse">ISD Arabia Admin</h1>
        <p className="mt-1 text-body-sm text-text-secondary">
          Sign in to manage the catalogue and quotations.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <div>
            <label className="field-label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              className="field-input"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email ? (
              <p id="email-error" className="field-error">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="field-input"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password ? (
              <p id="password-error" className="field-error">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {/* Announced rather than only shown, per the accessibility floor. */}
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
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
