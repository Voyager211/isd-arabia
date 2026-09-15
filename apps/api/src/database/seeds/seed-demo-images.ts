import { writeFileSync } from 'node:fs';
import { v2 as cloudinary } from 'cloudinary';
import { z } from 'zod';

import { toSlug } from '@/common/utils/slug.util';
import { expandCloudinaryUrl } from '@/config/cloudinary-url';
import { loadEnvFile } from '@/config/load-env';
import {
  DEMO_IMAGE_MANIFEST_PATH,
  DEMO_IMAGE_QUERIES,
  readDemoImageManifest,
  type DemoImage,
  type DemoImageManifest,
} from './demo-images.data';
import { SEED_CATEGORY_TREE, SEED_FLAT_CATEGORIES, type SeedCategory } from './taxonomy.data';

/**
 * Finds freely licensed photos for every leaf category on Wikimedia Commons,
 * uploads them to Cloudinary, and records them in the demo image manifest.
 *
 *   npm run seed:demo-images                          # fill whatever is missing
 *   npm run seed:demo-images -- --dry-run             # show picks, upload nothing
 *   npm run seed:demo-images -- --only=fire-blankets --refresh
 *
 * Resumable: the manifest is written after every category, and categories that
 * already have enough images are skipped.
 */

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
/** Wikimedia rejects requests without a descriptive User-Agent. */
const USER_AGENT = 'isd-arabia-demo-seed/1.0 (https://isd-arabia-storefront.vercel.app)';
const THUMB_WIDTH = 1280;

/** Licenses that allow commercial reuse. BY and BY-SA are credited in the manifest. */
const ALLOWED_LICENSE = /^(cc0|public domain|pd\b|cc by(-sa)? \d)/i;
/** Commons search also returns scans, schematics, logos and museum pieces — none of them product shots. */
const REJECTED_TITLE =
  /logo|diagram|map\b|icon|drawing|chart|flag|coat of arms|sketch|patent|poster|stamp|advert|museum|musée|wellcome|dpla|\bMET\b|letter|auction|graffiti|explod|optical/i;

/** Crude, but applied to both sides, so it only has to be consistent. */
function singular(word: string): string {
  if (/(sh|ch|x|ss|z)es$/.test(word)) return word.slice(0, -2);
  if (/[^s]s$/.test(word)) return word.slice(0, -1);
  return word;
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular);
}

/**
 * Commons full-text search matches a term anywhere in a file's description, so
 * "electrode oven" returns cooking ranges. The query must appear in the file
 * TITLE as a phrase — words merely present match "apron" to an airport apron
 * and "firefighter hood" to a Corvette's bonnet.
 */
function titleMatches(title: string, query: string): boolean {
  const titleWords = words(title);
  const phrase = words(query);

  return titleWords.some((_, start) =>
    phrase.every((word, offset) => titleWords[start + offset] === word),
  );
}

const cloudinaryEnv = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is empty.'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is empty.'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is empty.'),
  CLOUDINARY_UPLOAD_FOLDER: z.string().min(1).default('isd-arabia'),
});

interface CommonsPage {
  title: string;
  index?: number;
  imageinfo?: {
    thumburl?: string;
    width: number;
    height: number;
    mime: string;
    descriptionurl: string;
    extmetadata?: Record<string, { value: string } | undefined>;
  }[];
}

interface Candidate {
  title: string;
  thumbUrl: string;
  mime: string;
  license: string;
  author: string;
  source: string;
}

function leafNames(nodes: SeedCategory[]): string[] {
  return nodes.flatMap((node) => (node.children?.length ? leafNames(node.children) : [node.name]));
}

function stripHtml(value: string | undefined): string {
  return (value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleToAlt(title: string): string {
  return title
    .replace(/^File:/, '')
    .replace(/\.[a-z]+$/i, '')
    .replace(/_/g, ' ')
    .trim();
}

/** Cloudinary rejects with a plain `{ message, http_code }` object, not an Error. */
function describeError(error: unknown): string {
  const nested = (error as { error?: { message?: string } })?.error?.message;
  const cause = (error as { cause?: { code?: string } })?.cause?.code;
  const message = (error as { message?: string })?.message ?? nested ?? JSON.stringify(error);
  return cause ? `${message} (${cause})` : message;
}

/**
 * Retries rate limits, server errors AND dropped connections. Node's fetch
 * throws a bare "fetch failed" on a reset socket, and a long run of downloads
 * from Wikimedia hits that often enough to kill the whole run otherwise.
 */
async function fetchWithRetry(url: string, attempts = 5): Promise<Response> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      const retryable = response.status === 429 || response.status >= 500;
      if (response.ok || !retryable || attempt >= attempts) return response;
    } catch (error) {
      if (attempt >= attempts) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }
}

async function searchCommons(query: string): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${query} filetype:bitmap`,
    gsrlimit: '25',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
    iiextmetadatafilter: 'LicenseShortName|Artist',
  });

  const response = await fetchWithRetry(`${COMMONS_API}?${params.toString()}`);
  if (!response.ok) throw new Error(`Commons search '${query}' returned ${response.status}`);

  const body = (await response.json()) as { query?: { pages?: CommonsPage[] } };
  const pages = [...(body.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  return pages.flatMap((page): Candidate[] => {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) return [];

    const license = stripHtml(info.extmetadata?.LicenseShortName?.value);
    const ratio = info.width / info.height;

    const usable =
      ['image/jpeg', 'image/png'].includes(info.mime) &&
      info.width >= 900 &&
      info.height >= 600 &&
      ratio >= 0.6 &&
      ratio <= 2 &&
      ALLOWED_LICENSE.test(license) &&
      !REJECTED_TITLE.test(page.title) &&
      titleMatches(page.title, query);

    if (!usable) return [];

    return [
      {
        title: page.title,
        thumbUrl: info.thumburl,
        mime: info.mime,
        license,
        author: stripHtml(info.extmetadata?.Artist?.value) || 'Unknown',
        source: info.descriptionurl,
      },
    ];
  });
}

async function uploadCandidate(
  candidate: Candidate,
  folder: string,
  publicId: string,
): Promise<DemoImage> {
  const response = await fetchWithRetry(candidate.thumbUrl);
  if (!response.ok) throw new Error(`download returned ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const uploaded = await cloudinary.uploader.upload(
    `data:${candidate.mime};base64,${buffer.toString('base64')}`,
    {
      folder,
      public_id: publicId,
      resource_type: 'image',
      overwrite: true,
      invalidate: true,
      context: {
        caption: `${titleToAlt(candidate.title)} — ${candidate.author} (${candidate.license})`,
        source: candidate.source,
      },
    },
  );

  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    width: uploaded.width,
    height: uploaded.height,
    alt: titleToAlt(candidate.title),
    credit: {
      title: candidate.title,
      author: candidate.author,
      license: candidate.license,
      source: candidate.source,
    },
  };
}

function writeManifest(manifest: DemoImageManifest): void {
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(DEMO_IMAGE_MANIFEST_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
}

function flag(argv: string[], name: string): string | undefined {
  return argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
}

async function main(): Promise<void> {
  loadEnvFile();

  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const refresh = argv.includes('--refresh');
  const perCategory = Math.max(1, Number.parseInt(flag(argv, 'per-category') ?? '', 10) || 3);
  const only = flag(argv, 'only')?.split(',');

  let folder = '';
  if (!dryRun) {
    const parsed = cloudinaryEnv.safeParse(expandCloudinaryUrl(process.env));
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((issue) => issue.message).join(' '));
    }
    cloudinary.config({
      cloud_name: parsed.data.CLOUDINARY_CLOUD_NAME,
      api_key: parsed.data.CLOUDINARY_API_KEY,
      api_secret: parsed.data.CLOUDINARY_API_SECRET,
      secure: true,
    });
    folder = `${parsed.data.CLOUDINARY_UPLOAD_FOLDER}/demo/products`;
  }

  const manifest = readDemoImageManifest();
  const targets = leafNames([...SEED_CATEGORY_TREE, ...SEED_FLAT_CATEGORIES])
    .map((name) => ({ name, slug: toSlug(name) }))
    .filter(({ slug }) => !only || only.includes(slug));

  if (refresh) {
    for (const { slug } of targets) delete manifest[slug];
  }

  // One photo never appears under two categories.
  const used = new Set(
    Object.values(manifest)
      .flat()
      .map((image) => image.credit.source),
  );
  const shortfalls: string[] = [];

  console.log(
    `${dryRun ? 'Dry run — ' : ''}${targets.length} categories, ${perCategory} images each\n`,
  );

  for (const { name, slug } of targets) {
    const images = manifest[slug] ?? [];
    if (images.length >= perCategory) {
      console.log(`  · ${slug}: already has ${images.length}`);
      continue;
    }

    const picks: Candidate[] = [];
    for (const query of DEMO_IMAGE_QUERIES[name] ?? [name]) {
      if (images.length + picks.length >= perCategory) break;

      let candidates: Candidate[] = [];
      try {
        candidates = await searchCommons(query);
      } catch (error) {
        // One unreachable search should cost one query, not the run.
        console.log(`      ! search '${query}': ${describeError(error)}`);
      }

      for (const candidate of candidates) {
        if (used.has(candidate.source)) continue;
        used.add(candidate.source);
        picks.push(candidate);
        if (images.length + picks.length >= perCategory) break;
      }
    }

    console.log(`  · ${slug}:`);
    for (const pick of picks) console.log(`      ${pick.title}  [${pick.license}]`);

    if (!dryRun) {
      for (const pick of picks) {
        try {
          images.push(await uploadCandidate(pick, folder, `${slug}-${images.length + 1}`));
        } catch (error) {
          console.log(`      ! ${pick.title}: ${describeError(error)}`);
        }
      }
      manifest[slug] = images;
      writeManifest(manifest);
    }

    const total = dryRun ? images.length + picks.length : images.length;
    if (total < perCategory) shortfalls.push(`${slug} (${total}/${perCategory})`);
  }

  if (shortfalls.length) {
    console.log(`\nShort of images — add search terms in demo-images.data.ts:`);
    for (const shortfall of shortfalls) console.log(`  • ${shortfall}`);
  }

  if (!dryRun) {
    console.log(`\nManifest written to ${DEMO_IMAGE_MANIFEST_PATH}`);
    console.log(
      `Remove the uploads again with cloudinary.api.delete_resources_by_prefix('${folder}/')`,
    );
  }
}

main().catch((error: Error) => {
  console.error(`\nDemo image seed failed: ${error.message}\n`);
  process.exitCode = 1;
});
