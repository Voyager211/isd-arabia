import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * Shared Axios instance (PROJECT_PLAN.md §3.2, §12.2).
 *
 * `withCredentials` is what makes the httpOnly auth cookies travel. Tokens are
 * never read or written here — they are not reachable from JavaScript, which
 * is the entire point of putting them in httpOnly cookies rather than
 * localStorage, where an XSS could read them.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  withCredentials: true,
  headers: { 'content-type': 'application/json' },
  timeout: 20_000,
});

export interface NormalisedError {
  code: string;
  message: string;
  details?: { field?: string; message: string }[];
  status?: number;
}

export function normaliseError(error: unknown): NormalisedError {
  if (axios.isAxiosError(error)) {
    const envelope = error.response?.data as
      | {
          error?: {
            code?: string;
            message?: string;
            details?: { field?: string; message: string }[];
          };
        }
      | undefined;

    if (envelope?.error) {
      return {
        code: envelope.error.code ?? 'INTERNAL_ERROR',
        message: envelope.error.message ?? 'Something went wrong.',
        details: envelope.error.details,
        status: error.response?.status,
      };
    }

    if (error.code === 'ECONNABORTED') {
      return { code: 'TIMEOUT', message: 'The request timed out. Please try again.' };
    }

    return {
      code: 'NETWORK_ERROR',
      message: 'Could not reach the API. Check your connection and try again.',
      status: error.response?.status,
    };
  }

  return { code: 'INTERNAL_ERROR', message: 'Something went wrong.' };
}

/** Unwraps the `{ success, data }` envelope the API returns on every response. */
export async function get<TData>(url: string, config?: AxiosRequestConfig): Promise<TData> {
  const response = await apiClient.get<{ data: TData }>(url, config);
  return response.data.data;
}

export async function post<TData>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<TData> {
  const response = await apiClient.post<{ data: TData }>(url, body, config);
  return response.data.data;
}

export async function patch<TData>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<TData> {
  const response = await apiClient.patch<{ data: TData }>(url, body, config);
  return response.data.data;
}

export async function del<TData>(url: string, config?: AxiosRequestConfig): Promise<TData> {
  const response = await apiClient.delete<{ data: TData }>(url, config);
  return response.data.data;
}

/** Marks a request that must never be retried through the refresh flow. */
interface RetriableConfig extends AxiosRequestConfig {
  _retried?: boolean;
}

/** Endpoints where a 401 is the answer, not a stale session. */
const NO_REFRESH_PATHS = ['/admin/auth/login', '/admin/auth/refresh', '/admin/auth/logout'];

/**
 * Installs the 401 → refresh → retry interceptor.
 *
 * Called once from AuthProvider so the redirect on failure can go through the
 * router rather than a hard `location.assign`, which would discard unsaved
 * work in an open form (acceptance criterion #17).
 *
 * Exactly one refresh attempt per request. Without the `_retried` flag a
 * failing refresh produces an infinite 401 loop that hammers the API.
 */
export function installAuthInterceptor(onSessionExpired: () => void): () => void {
  let refreshInFlight: Promise<void> | null = null;

  const id = apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetriableConfig | undefined;
      const status = error.response?.status;
      const url = config?.url ?? '';

      const shouldRefresh =
        status === 401 &&
        config &&
        !config._retried &&
        !NO_REFRESH_PATHS.some((path) => url.includes(path));

      if (!shouldRefresh) {
        if (status === 401 && NO_REFRESH_PATHS.every((path) => !url.includes(path))) {
          onSessionExpired();
        }
        return Promise.reject(error);
      }

      config._retried = true;

      // Concurrent 401s share one refresh call rather than each firing their
      // own, which would rotate the token out from under the others.
      refreshInFlight ??= apiClient
        .post('/admin/auth/refresh')
        .then(() => undefined)
        .finally(() => {
          refreshInFlight = null;
        });

      try {
        await refreshInFlight;
        return await apiClient.request(config);
      } catch (refreshError) {
        onSessionExpired();
        return Promise.reject(refreshError);
      }
    },
  );

  return () => apiClient.interceptors.response.eject(id);
}
