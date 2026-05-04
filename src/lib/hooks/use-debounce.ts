import { useEffect, useState } from 'react';

/**
 * Returns a debounced version of `value` that only updates after `ms`
 * milliseconds have passed without a change. Used for search inputs so we
 * don't hammer the API on every keystroke.
 */
export function useDebounce<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
