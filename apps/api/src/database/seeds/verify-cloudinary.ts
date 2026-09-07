import 'reflect-metadata';
import { v2 as cloudinary } from 'cloudinary';

import { z } from 'zod';

import { loadEnvFile } from '@/config/load-env';
import { expandCloudinaryUrl } from '@/config/cloudinary-url';

/**
 * Verifies the Cloudinary account is configured for what this app actually
 * does (PROJECT_PLAN.md §13).
 *
 *   npm run verify:cloudinary --workspace @isd/api
 *
 * Credentials that merely authenticate are not enough. Two things silently
 * fail later otherwise:
 *
 *   1. **PDF/ZIP delivery is blocked by default** on new Cloudinary accounts.
 *      The catalogue upload succeeds, the lead is captured, and every signed
 *      URL returns 401 — so the first person to discover it is a customer who
 *      just filled in the form.
 *
 *   2. Signed uploads must sign exactly the parameters the browser sends. A
 *      mismatch is a 401 from Cloudinary at upload time.
 *
 * So this does a real round trip for both an image and an authenticated raw
 * file, then cleans up after itself.
 */

/** A 1×1 transparent PNG. */
const TEST_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** The smallest structurally valid PDF. */
const TEST_PDF = `data:application/pdf;base64,${Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 8 8]/Parent 2 0 R>>endobj\n' +
    'trailer<</Root 1 0 R>>',
).toString('base64')}`;

/**
 * Only the Cloudinary keys.
 *
 * Deliberately NOT the full `validateEnv` contract: this script exists to be
 * run part-way through filling in .env, and refusing to check Cloudinary until
 * SMTP credentials exist would make it useless at exactly the moment it is
 * needed.
 */
const cloudinaryEnv = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is empty.'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is empty.'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is empty.'),
  CLOUDINARY_UPLOAD_FOLDER: z.string().min(1).default('isd-arabia'),
});

interface Check {
  label: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

const checks: Check[] = [];

/**
 * Cloudinary reports an under-privileged API key as a bare 403 on the upload
 * endpoint, with no hint that the key's ROLE is the problem — `api.ping()`
 * still succeeds, because reading is permitted and writing is not.
 *
 * A "Media Library User" key with no folder permissions assigned behaves
 * exactly this way, so the message points there rather than at the account
 * settings, which is where the raw error sends you.
 */
function isForbidden(error: unknown): boolean {
  const message = (error as Error)?.message ?? '';
  const status = (error as { http_code?: number })?.http_code;
  // `http_code` is the reliable signal; the message check is a fallback for
  // SDK paths that surface the status only as text.
  return status === 403 || /(?<!\d)403(?!\d)/.test(message);
}

const ROLE_FIX =
  'The credentials are valid but this key is not allowed to write. Create a ' +
  'new key with the "Master Admin" role at Settings → API Keys — a "Media ' +
  'Library User" key cannot upload unless it has explicit folder permissions, ' +
  'which the console does not always offer.';

function record(label: string, ok: boolean, detail: string, fix?: string): void {
  checks.push({ label, ok, detail, fix });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}\n         ${detail}`);
  if (!ok && fix) console.log(`         → ${fix}`);
}

async function main(): Promise<void> {
  loadEnvFile();

  const parsed = cloudinaryEnv.safeParse(expandCloudinaryUrl(process.env));

  if (!parsed.success) {
    console.error('\nCloudinary is not configured yet:\n');

    for (const issue of parsed.error.issues) {
      console.error(`  • ${issue.message}`);
    }

    console.error(
      '\nFill these in at apps/api/.env — the values are in the Cloudinary\n' +
        'dashboard under Settings → API Keys.\n',
    );

    process.exitCode = 1;
    return;
  }

  const env = parsed.data;
  const folder = `${env.CLOUDINARY_UPLOAD_FOLDER}/_verify`;

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  console.log(`\nVerifying Cloudinary account '${env.CLOUDINARY_CLOUD_NAME}'\n`);

  // ── 1. Credentials ──────────────────────────────────────────────────────
  try {
    await cloudinary.api.ping();
    record('Credentials', true, 'The cloud name, API key and secret are accepted.');
  } catch (error) {
    record(
      'Credentials',
      false,
      (error as Error).message,
      'Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET ' +
        'against Settings → API Keys.',
    );
    // Nothing else can succeed, so stop here rather than emit a wall of
    // consequential failures.
    return summarise();
  }

  // ── 2. Image upload ─────────────────────────────────────────────────────
  let imagePublicId: string | null = null;
  try {
    const uploaded = await cloudinary.uploader.upload(TEST_IMAGE, {
      folder,
      resource_type: 'image',
    });
    imagePublicId = uploaded.public_id;
    record('Image upload', true, `Uploaded to ${uploaded.public_id}`);
  } catch (error) {
    record(
      'Image upload',
      false,
      (error as Error).message,
      isForbidden(error) ? ROLE_FIX : undefined,
    );
  }

  // ── 3. Image delivery with the transformations the app uses ─────────────
  if (imagePublicId) {
    const url = cloudinary.url(imagePublicId, {
      secure: true,
      transformation: [{ raw_transformation: 'w_400,h_400,c_pad,b_white,q_auto,f_auto' }],
    });

    try {
      const response = await fetch(url);
      record(
        'Image delivery (c_pad preset)',
        response.ok,
        response.ok
          ? `${response.status} from the product-card transformation.`
          : `${response.status} ${response.statusText}`,
        response.ok
          ? undefined
          : 'Check Settings → Security for restricted media types or a strict transformation allowlist.',
      );
    } catch (error) {
      record('Image delivery (c_pad preset)', false, (error as Error).message);
    }
  }

  // ── 4. Authenticated raw upload — the catalogue PDF path ────────────────
  let pdfPublicId: string | null = null;
  try {
    const uploaded = await cloudinary.uploader.upload(TEST_PDF, {
      folder,
      resource_type: 'raw',
      type: 'authenticated',
    });
    pdfPublicId = uploaded.public_id;
    record('Authenticated PDF upload', true, `Uploaded to ${uploaded.public_id}`);
  } catch (error) {
    record(
      'Authenticated PDF upload',
      false,
      (error as Error).message,
      isForbidden(error) ? ROLE_FIX : 'Check Settings → Security allows authenticated raw uploads.',
    );
  }

  // ── 5. Signed delivery — the check that actually matters ────────────────
  if (pdfPublicId) {
    const expiresAt = Math.floor(Date.now() / 1000) + 900;
    const url = cloudinary.utils.private_download_url(pdfPublicId, 'pdf', {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: expiresAt,
    });

    try {
      const response = await fetch(url);

      record(
        'Signed PDF delivery',
        response.ok,
        response.ok
          ? `${response.status} — the catalogue download will work.`
          : `${response.status} ${response.statusText}`,
        response.ok
          ? undefined
          : 'Almost certainly the PDF/ZIP delivery restriction. Go to ' +
              'Settings → Security and UNCHECK "PDF and ZIP files delivery". ' +
              'It is enabled by default and blocks every signed catalogue URL.',
      );
    } catch (error) {
      record('Signed PDF delivery', false, (error as Error).message);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  const cleanup: Promise<unknown>[] = [];
  if (imagePublicId) {
    cleanup.push(cloudinary.uploader.destroy(imagePublicId, { resource_type: 'image' }));
  }
  if (pdfPublicId) {
    cleanup.push(
      cloudinary.uploader.destroy(pdfPublicId, { resource_type: 'raw', type: 'authenticated' }),
    );
  }

  await Promise.allSettled(cleanup);
  console.log(`\n  Cleaned up the test assets in ${folder}/`);

  summarise();
}

function summarise(): void {
  const failed = checks.filter((check) => !check.ok);

  if (!failed.length) {
    console.log('\nAll checks passed. Cloudinary is ready.\n');
    return;
  }

  console.log(`\n${failed.length} check(s) failed:\n`);
  for (const check of failed) {
    console.log(`  • ${check.label}`);
    if (check.fix) console.log(`    ${check.fix}`);
  }
  console.log('');
  process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(`\nVerification could not run: ${error.message}\n`);
  process.exitCode = 1;
});
