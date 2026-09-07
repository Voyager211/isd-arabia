import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * Loads `.env` for scripts that run outside the Nest bootstrap.
 *
 * `ConfigModule.forRoot({ envFilePath })` handles this for the running app,
 * but the seed and verification scripts are plain ts-node entry points — they
 * never touch that module, so without this they see whatever happens to be in
 * the shell and report the entire contract as missing.
 *
 * `.env.local` wins over `.env`, matching the ConfigModule order so a script
 * and the app cannot disagree about which file they read.
 */
export function loadEnvFile(): void {
  // Resolved from this file rather than the working directory, so the scripts
  // behave the same whether run from the repo root or from apps/api.
  const apiRoot = resolve(__dirname, '..', '..');

  for (const filename of ['.env.local', '.env']) {
    const path = resolve(apiRoot, filename);
    // `override: false` means the first file to define a key wins, and a real
    // environment variable always beats the file — which is what production
    // hosting relies on.
    if (existsSync(path)) loadDotenv({ path, override: false });
  }
}
