import { describe, it, expect, beforeEach } from 'vitest';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens, isRemembered } from '../lib/token-store';

// Sam feedback S6: "Keep me signed in" did nothing — tokens always went to
// localStorage. Unticked must mean the session dies with the browser.
describe('token-store ("Keep me signed in")', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const pair = { accessToken: 'acc-1', refreshToken: 'ref-1' };

  it('ticked → tokens persist in localStorage only', () => {
    saveTokens(pair, true);
    expect(localStorage.getItem('accessToken')).toBe('acc-1');
    expect(localStorage.getItem('refreshToken')).toBe('ref-1');
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(isRemembered()).toBe(true);
  });

  it('unticked → tokens live in sessionStorage only (gone when the browser closes)', () => {
    saveTokens(pair, false);
    expect(sessionStorage.getItem('accessToken')).toBe('acc-1');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(getAccessToken()).toBe('acc-1');
    expect(isRemembered()).toBe(false);
    // Simulate closing the browser: sessionStorage is wiped, nothing left.
    sessionStorage.clear();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('an unticked login clears a stale remembered session', () => {
    saveTokens({ accessToken: 'old', refreshToken: 'old-r' }, true);
    saveTokens(pair, false);
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('a refresh keeps the pair in the store the session already uses', () => {
    saveTokens(pair, false);
    saveTokens({ accessToken: 'acc-2', refreshToken: 'ref-2' }); // refresh: no `remember`
    expect(sessionStorage.getItem('accessToken')).toBe('acc-2');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('sessions saved before this change (localStorage) keep working', () => {
    localStorage.setItem('accessToken', 'legacy');
    localStorage.setItem('refreshToken', 'legacy-r');
    expect(getAccessToken()).toBe('legacy');
    expect(getRefreshToken()).toBe('legacy-r');
    expect(isRemembered()).toBe(true);
  });

  it('logout clears both stores', () => {
    saveTokens(pair, true);
    sessionStorage.setItem('accessToken', 'x');
    clearTokens();
    expect(getAccessToken()).toBeNull();
    for (const s of [localStorage, sessionStorage]) {
      expect(s.getItem('accessToken')).toBeNull();
      expect(s.getItem('refreshToken')).toBeNull();
    }
  });
});
