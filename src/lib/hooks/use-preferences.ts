import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { logError } from '@/lib/log';

// Feedback N2 (Sam, 29 Sep 2026): "Preferences only saved in this browser —
// dashboard layout, campaign grouping and task filter don't follow me to
// another device." The server (GET/PUT /users/me/preferences) is now the
// source of truth; localStorage stays as a cache so the page renders the
// right layout instantly and still works if the preferences call fails
// (older backend, offline).

export type PreferenceKey = 'dashboardLayout' | 'campaignGrouping' | 'taskFilters';
type Preferences = Partial<Record<PreferenceKey, unknown>>;

export const PREFERENCES_QUERY_KEY = ['me', 'preferences'] as const;

function readLocal(localKey: string): string | null {
  try { return typeof window !== 'undefined' ? localStorage.getItem(localKey) : null; } catch { return null; }
}
function writeLocal(localKey: string, raw: string | null) {
  try {
    if (raw === null) localStorage.removeItem(localKey);
    else localStorage.setItem(localKey, raw);
  } catch { /* storage blocked — the server copy still applies */ }
}

async function putPreference(key: PreferenceKey, value: unknown) {
  await api.put(`/api/v1/users/me/preferences`, { [key]: value });
}

/**
 * One persisted preference.
 *
 * - `localKey` is the existing localStorage key, so nobody loses their saved
 *   layout: on first load, a local value the server doesn't have yet is
 *   uploaded once (migration), and the server value wins from then on.
 * - `decode` turns a stored value (server JSON or parsed localStorage) into T,
 *   returning undefined for anything malformed, so a bad row can never break
 *   the page — it falls back to `fallback`.
 * - `set` updates the screen immediately; the server save is best-effort and a
 *   failure is logged, not shown, because the preference still applies here.
 */
export function useServerPreference<T>(
  key: PreferenceKey,
  localKey: string,
  decode: (raw: unknown) => T | undefined,
  fallback: T,
  opts: { localIsJson?: boolean } = {},
) {
  const localIsJson = opts.localIsJson ?? false;
  const parseLocal = useCallback((): T | undefined => {
    const raw = readLocal(localKey);
    if (raw === null) return undefined;
    if (!localIsJson) return decode(raw);
    try { return decode(JSON.parse(raw)); } catch { return undefined; }
  }, [localKey, localIsJson, decode]);

  const [value, setValue] = useState<T>(() => parseLocal() ?? fallback);
  const synced = useRef(false);
  const qc = useQueryClient();

  const { data: server, isSuccess } = useQuery({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: async () => unwrap(await api.get<{ preferences: Preferences }>('/api/v1/users/me/preferences')).preferences ?? {},
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!isSuccess || synced.current) return;
    synced.current = true;
    const fromServer = key in (server ?? {}) ? decode(server![key]) : undefined;
    if (fromServer !== undefined) {
      setValue(fromServer);
      writeLocal(localKey, localIsJson ? JSON.stringify(fromServer) : String(fromServer));
      return;
    }
    // Server has nothing for this key yet — upload what this browser has, once.
    const local = parseLocal();
    if (local !== undefined) {
      putPreference(key, local).catch((err) => logError(`Uploading ${key} preference failed`, err));
    }
  }, [isSuccess, server, key, localKey, localIsJson, decode, parseLocal]);

  const set = useCallback((next: T | null) => {
    // A change made while the first GET is still in flight must win: cancel
    // that fetch so its (older) answer can't land in the cache and snap the
    // value back — now, or on the next mount while the cache is fresh.
    void qc.cancelQueries({ queryKey: PREFERENCES_QUERY_KEY });
    synced.current = true;
    setValue(next === null ? fallback : next);
    writeLocal(localKey, next === null ? null : localIsJson ? JSON.stringify(next) : String(next));
    qc.setQueryData<Preferences>(PREFERENCES_QUERY_KEY, (prev) => {
      const copy = { ...(prev ?? {}) };
      if (next === null) delete copy[key]; else copy[key] = next;
      return copy;
    });
    putPreference(key, next).catch((err) => logError(`Saving ${key} preference failed`, err));
  }, [fallback, localKey, localIsJson, key, qc]);

  return [value, set] as const;
}
