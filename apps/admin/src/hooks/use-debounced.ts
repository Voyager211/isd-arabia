import { useEffect, useState } from 'react';

/** Delays a rapidly changing value — used for the admin table search inputs. */
export function useDebounced<TValue>(value: TValue, delayMs = 300): TValue {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
