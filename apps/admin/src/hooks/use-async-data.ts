import { useCallback, useEffect, useRef, useState } from 'react';

import { get, normaliseError } from '@/lib/api-client';

/**
 * Minimal data-fetching hook for the admin.
 *
 * Deliberately not a query library: the admin has a handful of screens, each
 * loading one or two resources, and every mutation is followed by an explicit
 * refetch. Adding a cache layer here would be more configuration than the
 * problem has.
 *
 * The cancellation flag matters — an admin clicking through the sidebar faster
 * than the API responds would otherwise get a resolved request writing state
 * into an unmounted component, or a slow earlier response overwriting a fast
 * later one.
 */
export interface AsyncState<TData> {
  data: TData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: (data: TData | null) => void;
}

export function useAsyncData<TData>(
  url: string | null,
  options: { params?: Record<string, unknown> } = {},
): AsyncState<TData> {
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const paramsKey = JSON.stringify(options.params ?? {});

  const load = useCallback(async () => {
    if (!url) {
      setIsLoading(false);
      return;
    }

    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await get<TData>(url, { params: options.params });
      // A later request has already been issued; discard this result.
      if (id !== requestId.current) return;
      setData(result);
    } catch (caught) {
      if (id !== requestId.current) return;
      setError(normaliseError(caught).message);
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
    // options.params is compared by value through paramsKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load, setData };
}
