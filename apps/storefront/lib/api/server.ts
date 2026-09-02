import 'server-only';

import type { ApiResponse } from '@isd/shared-types';

/**
 * Server-side API client (PROJECT_PLAN.md §4.2, §4.4).
 *
 * Two things this exists to enforce:
 *
 *  1. **Every fetch carries cache tags.** `tags` is a required argument, not an
 *     option. An untagged fetch cannot be purged on demand, so an admin edit
 *     appears to do nothing for up to an hour — which reads as a bug and
 *     generates support noise.
 *
 *  2. **The internal URL never leaks to the browser.** `server-only` makes
 *     importing this from a client component a build error rather than a
 *     runtime surprise.
 */

const API_BASE = process.env.API_INTERNAL_URL;

export const Revalidate = {
  /** Listing and menu data — changes whenever an admin saves. */
  hour: 3600,
  /** Detail pages — on-demand purge is the real refresh path. */
  day: 86_400,
} as const;

export interface ServerFetchOptions {
  /**
   * Cache tags this response should be purged by. Required.
   * Use the helpers in `lib/api/tags.ts` rather than string literals.
   */
  tags: string[];
  revalidate?: number;
  searchParams?: Record<string, string | string[] | number | boolean | undefined>;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function buildUrl(path: string, searchParams?: ServerFetchOptions['searchParams']): string {
  if (!API_BASE) {
    throw new Error('API_INTERNAL_URL is not set. See apps/storefront/.env.example.');
  }

  const url = new URL(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`);

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => url.searchParams.append(key, String(entry)));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * Fetches and unwraps the API envelope, returning `data` and `meta` separately.
 * Throws `ApiRequestError` on a non-2xx or an unsuccessful envelope.
 */
export async function apiFetch<TData, TMeta = Record<string, unknown>>(
  path: string,
  options: ServerFetchOptions,
): Promise<{ data: TData; meta?: TMeta }> {
  const response = await fetch(buildUrl(path, options.searchParams), {
    headers: { accept: 'application/json' },
    next: {
      tags: options.tags,
      revalidate: options.revalidate ?? Revalidate.hour,
    },
  });

  let body: ApiResponse<TData, TMeta>;
  try {
    body = (await response.json()) as ApiResponse<TData, TMeta>;
  } catch {
    throw new ApiRequestError(
      response.status,
      'INTERNAL_ERROR',
      `The API returned a non-JSON response (${response.status}).`,
    );
  }

  if (!response.ok || !body.success) {
    const error = 'error' in body ? body.error : undefined;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? `Request to ${path} failed with ${response.status}.`,
    );
  }

  return { data: body.data, meta: body.meta };
}

/** `apiFetch` for the common case where only `data` is needed. */
export async function apiGet<TData>(path: string, options: ServerFetchOptions): Promise<TData> {
  const { data } = await apiFetch<TData>(path, options);
  return data;
}

/**
 * Returns `null` on a 404 instead of throwing, for routes that render their own
 * not-found state. Any other failure still throws — a 500 must not be
 * silently rendered as "this product does not exist", which would let the
 * catalogue quietly empty itself during an API outage.
 */
export async function apiGetOrNull<TData>(
  path: string,
  options: ServerFetchOptions,
): Promise<TData | null> {
  try {
    return await apiGet<TData>(path, options);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}
