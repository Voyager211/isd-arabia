import { z } from 'zod';

/**
 * The environment the seed script actually uses.
 *
 * Deliberately narrower than the full `validateEnv` contract. Seeding the
 * taxonomy touches the database and nothing else, so demanding Cloudinary and
 * SMTP credentials first would block the very first thing anyone does with a
 * fresh checkout — and would push people toward filling those keys with
 * placeholder junk to get past the check, which is worse than not checking.
 *
 * The running API still validates the whole contract at boot. That is where
 * the guarantee belongs: a half-configured deployment must not serve traffic,
 * but a half-configured laptop should still be able to seed.
 */
export const seedEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required.'),
  MONGODB_DB_NAME: z.string().min(1, 'MONGODB_DB_NAME is required.'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // Optional locally; required in production, enforced below.
  SEED_ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  SEED_ADMIN_PASSWORD: z.string().optional().or(z.literal('')),
  SEED_ADMIN_NAME: z.string().optional().or(z.literal('')),
});

export type SeedEnv = z.infer<typeof seedEnvSchema>;

export function validateSeedEnv(raw: Record<string, unknown>): SeedEnv {
  const result = seedEnvSchema.safeParse(raw);

  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(
      `The seed script cannot run with this environment.\n${lines.join('\n')}\n\n` +
        'Only the database connection is required to seed — see apps/api/.env.example.',
    );
  }

  // Empty strings are treated as absent, so a half-filled .env behaves the
  // same as one where the key was never added.
  return {
    ...result.data,
    SEED_ADMIN_EMAIL: result.data.SEED_ADMIN_EMAIL || undefined,
    SEED_ADMIN_PASSWORD: result.data.SEED_ADMIN_PASSWORD || undefined,
    SEED_ADMIN_NAME: result.data.SEED_ADMIN_NAME || undefined,
  };
}
