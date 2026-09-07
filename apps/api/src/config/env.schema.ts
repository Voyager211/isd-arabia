import { z } from 'zod';

import { expandCloudinaryUrl } from './cloudinary-url';

/**
 * Environment contract (PROJECT_PLAN.md §14.3).
 *
 * Validated once at boot. The process exits on a missing or malformed value
 * rather than starting broken and failing at the first request — acceptance
 * criterion #29.
 */

const csv = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().url()));

const bool = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    API_PREFIX: z.string().startsWith('/').default('/api/v1'),

    // ── Database ────────────────────────────────────────────────────────
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    MONGODB_DB_NAME: z.string().min(1, 'MONGODB_DB_NAME is required'),

    // ── Auth ────────────────────────────────────────────────────────────
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    COOKIE_DOMAIN: z.string().optional(),

    /**
     * Set true when the admin and the API are on DIFFERENT registrable
     * domains — for example admin.vercel.app calling api.onrender.com.
     *
     * Auth cookies are SameSite=Strict by default, which is correct when both
     * sit under one parent domain (admin.example.com + api.example.com, the
     * arrangement PROJECT_PLAN.md §14.4 assumes). Across different domains a
     * Strict cookie is simply never sent, so login succeeds and every
     * subsequent request is a 401 — with nothing in any log to explain it.
     *
     * Switching this on relaxes the cookies to SameSite=None; Secure. CSRF
     * protection then rests on the CORS allowlist rather than the browser's
     * same-site rule: the endpoints accept only application/json, which a
     * cross-site form cannot send, and the resulting preflight is refused for
     * any origin not in STOREFRONT_ORIGIN / ADMIN_ORIGIN.
     *
     * Prefer a shared parent domain over this whenever you control the DNS.
     */
    COOKIE_CROSS_SITE: bool.default('false'),

    // ── Admin seed (PROJECT_PLAN.md §12.1) ──────────────────────────────
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_PASSWORD: z.string().optional(),
    SEED_ADMIN_NAME: z.string().optional(),

    // ── Cloudinary ──────────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
    CLOUDINARY_UPLOAD_FOLDER: z.string().min(1).default('isd-arabia'),
    /** Accepted as an alternative to the three variables above (see below). */
    CLOUDINARY_URL: z.string().optional(),

    // ── CORS (never '*' with credentials) ───────────────────────────────
    STOREFRONT_ORIGIN: z.string().url(),
    ADMIN_ORIGIN: z.string().url(),
    EXTRA_CORS_ORIGINS: csv.optional(),

    // ── On-demand revalidation (PROJECT_PLAN.md §4.2) ───────────────────
    STOREFRONT_REVALIDATE_URL: z.string().url(),
    REVALIDATE_SECRET: z.string().min(16, 'REVALIDATE_SECRET must be at least 16 characters'),

    /**
     * Mail — the internal quotation notification, and nothing else.
     *
     * Optional at this level and required conditionally below: with
     * `QUOTATION_NOTIFY_ENABLED=false` there is nothing to send, so demanding
     * SMTP credentials would block local development on a feature that is
     * switched off — and push people into inventing placeholder values, which
     * is worse than not checking.
     */
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    QUOTATION_NOTIFY_TO: z.string().optional(),
    QUOTATION_NOTIFY_ENABLED: bool.default('true'),

    // ── Spam ────────────────────────────────────────────────────────────
    TURNSTILE_SECRET_KEY: z.string().min(1),
    /** Escape hatch for local development and e2e runs only. */
    TURNSTILE_ENABLED: bool.default('true'),
  })
  .superRefine((env, ctx) => {
    // Guardrail 1 of PROJECT_PLAN.md §12.1: the documented default credential
    // is fine for local and staging, and must never reach a live admin panel.
    if (env.NODE_ENV === 'production') {
      if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SEED_ADMIN_EMAIL'],
          message:
            'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required in production — the default seed credential is refused.',
        });
      }
      if (env.TURNSTILE_ENABLED === false) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['TURNSTILE_ENABLED'],
          message: 'TURNSTILE_ENABLED cannot be false in production.',
        });
      }
    }

    /**
     * Mail is required only when it is switched on.
     *
     * Enabling notifications without somewhere to send them is a
     * misconfiguration that would otherwise surface as a logged failure on
     * the first real quotation — the one moment nobody is watching the logs.
     */
    if (env.QUOTATION_NOTIFY_ENABLED) {
      const missing = (
        [
          ['SMTP_HOST', env.SMTP_HOST],
          ['SMTP_USER', env.SMTP_USER],
          ['SMTP_PASSWORD', env.SMTP_PASSWORD],
          ['MAIL_FROM', env.MAIL_FROM],
          ['QUOTATION_NOTIFY_TO', env.QUOTATION_NOTIFY_TO],
        ] as const
      ).filter(([, value]) => !value);

      for (const [key] of missing) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required while QUOTATION_NOTIFY_ENABLED is true. Set it, or set QUOTATION_NOTIFY_ENABLED=false to run without notifications.`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates `process.env`. Throws with every failing variable
 * listed, not just the first — a half-configured deploy should surface all of
 * its gaps in one pass.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  // CLOUDINARY_URL is what the Cloudinary console hands you; expand it into
  // the three discrete variables before validating.
  const result = envSchema.safeParse(expandCloudinaryUrl(raw));

  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(
      `Invalid environment configuration — the API will not start.\n${lines.join('\n')}\n\n` +
        'See apps/api/.env.example for the full contract (PROJECT_PLAN.md §14.3).',
    );
  }

  return result.data;
}
