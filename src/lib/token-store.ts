// ─── Auth token storage (Sam feedback S6, 29 Sep 2026) ──────────────────────
//
// "Keep me signed in" decides WHERE the tokens live:
//   ticked   → localStorage   — survives closing the browser (the old behaviour)
//   unticked → sessionStorage — cleared when the browser closes
//
// Every read/write of the access + refresh token goes through here so the
// login, refresh and logout paths can't disagree about which store is live.
// Sessions created before this change sit in localStorage; they keep working
// as "remembered" sessions (the box used to default to ticked).

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

function store(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    // Storage can throw in locked-down browsers — behave as if empty.
    return null;
  }
}

/** The store that currently holds a session, if any. sessionStorage wins. */
function activeStore(): Storage | null {
  const session = store('session');
  if (session?.getItem(ACCESS_KEY) || session?.getItem(REFRESH_KEY)) return session;
  return store('local');
}

export function getAccessToken(): string | null {
  return activeStore()?.getItem(ACCESS_KEY) ?? null;
}

export function getRefreshToken(): string | null {
  return activeStore()?.getItem(REFRESH_KEY) ?? null;
}

/** Whether the current session was created with "Keep me signed in". */
export function isRemembered(): boolean {
  return activeStore() === store('local');
}

/**
 * Save a fresh token pair. `remember` is passed on login; on refresh it's
 * omitted so the pair stays in whichever store the session already uses.
 */
export function saveTokens(
  tokens: { accessToken: string; refreshToken: string },
  remember: boolean = isRemembered(),
): void {
  const target = store(remember ? 'local' : 'session');
  const other = store(remember ? 'session' : 'local');
  // Never leave a copy in the other store — an unticked login must not be
  // resurrected from localStorage after the browser closes.
  other?.removeItem(ACCESS_KEY);
  other?.removeItem(REFRESH_KEY);
  target?.setItem(ACCESS_KEY, tokens.accessToken);
  target?.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  for (const s of [store('local'), store('session')]) {
    s?.removeItem(ACCESS_KEY);
    s?.removeItem(REFRESH_KEY);
  }
}
