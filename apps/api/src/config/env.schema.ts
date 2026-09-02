import { z } from 'zod';

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

    // ── Admin seed (PROJECT_PLAN.md §12.1) ──────────────────────────────
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_PASSWORD: z.string().optional(),
    SEED_ADMIN_NAME: z.string().optional(),

    // ── Cloudinary ──────────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
    CLOUDINARY_UPLOAD_FOLDER: z.string().min(1).default('isd-arabia'),

    // ── CORS (never '*' with credentials) ───────────────────────────────
    STOREFRONT_ORIGIN: z.string().url(),
    ADMIN_ORIGIN: z.string().url(),
    EXTRA_CORS_ORIGINS: csv.optional(),

    // ── On-demand revalidation (PROJECT_PLAN.md §4.2) ───────────────────
    STOREFRONT_REVALIDATE_URL: z.string().url(),
    REVALIDATE_SECRET: z.string().min(16, 'REVALIDATE_SECRET must be at least 16 characters'),

    // ── Mail — internal notification only ───────────────────────────────
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().min(1),
    SMTP_PASSWORD: z.string().min(1),
    MAIL_FROM: z.string().min(1),
    QUOTATION_NOTIFY_TO: z.string().min(1),
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
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates `process.env`. Throws with every failing variable
 * listed, not just the first — a half-configured deploy should surface all of
 * its gaps in one pass.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

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
