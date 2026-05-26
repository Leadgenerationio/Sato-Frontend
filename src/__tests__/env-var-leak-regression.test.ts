import { describe, it, expect } from 'vitest';

/**
 * Regression guard for OCT-45 + OCT-53.
 *
 * Backend implementation detail — exact env-var names (XERO_CLIENT_ID,
 * XERO_CLIENT_SECRET, LEADBYTE_API_KEY) and the hosting platform name
 * (Railway) — must never appear in operator-visible frontend strings. They
 * end up in screenshots, support tickets, and external screen shares, none
 * of which should give a casual viewer a starting point for guessing our
 * deployment topology or environment shape.
 *
 * OCT-45 fixed the Xero `invalid_client` toast on /integrations. OCT-53
 * extended the rule to bank/VAT widgets, /settings, and /leadbyte/buyers.
 * This test walks every non-test source file under src/ and asserts no
 * match — catching any future re-introduction without anyone needing to
 * remember the rule.
 *
 * Why a file-level scan instead of per-component render tests: the four
 * affected components have no existing test scaffolding, and the actual
 * regression risk is "developer drops the env-var name into a JSX string"
 * — exactly what a source-text scan catches with no mock setup. A future
 * render test for any of these components is welcome but not required to
 * keep this gate honest.
 */

const BANNED = [
  'XERO_CLIENT_ID',
  'XERO_CLIENT_SECRET',
  'LEADBYTE_API_KEY',
  // Anchored Railway phrases rather than the bare word "Railway" — every
  // historical leak fit one of these two shapes ("grep Railway logs" /
  // "set X on Railway"). A bare "Railway" ban would false-positive on any
  // innocuous future use (a country mention, an unrelated brand, etc.);
  // anchoring keeps the spirit of the OCT-45 fix without the noise.
  'Railway logs',
  'on Railway',
];

// Vite's import.meta.glob loads every matching source as a raw string at
// test build time, so the assertion runs entirely in-memory without needing
// `fs` / `@types/node`. The path is relative to THIS test file, which sits
// in src/__tests__/, so `../**/*` covers all of src/ outside this directory.
const sources = import.meta.glob('../**/*.{ts,tsx,js,jsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// Skip test fixtures — they may legitimately reference the banned strings to
// assert their absence elsewhere (this file itself is the obvious example).
function isTestPath(p: string): boolean {
  return p.includes('__tests__') || /\.test\.[tj]sx?$/.test(p);
}

/**
 * Per-(path, literal) allowlist. Each entry must include a reason that
 * justifies why the bare literal is acceptable in that specific file. If
 * the file containing the literal changes shape (e.g. a role guard is
 * removed), the exemption MUST be revisited rather than blindly extended.
 *
 * Match is by path SUFFIX so the test works the same on Windows and POSIX
 * separators without normalising both sides.
 */
const EXEMPTIONS: Array<{ pathSuffix: string; banned: string; reason: string }> = [
  {
    pathSuffix: 'pages/settings.tsx',
    banned: 'XERO_CLIENT_ID',
    reason: 'Role-gated to owner (the deploy admin who sets env-vars) — see XeroIntegration.',
  },
  {
    pathSuffix: 'pages/settings.tsx',
    banned: 'XERO_CLIENT_SECRET',
    reason: 'Role-gated to owner (the deploy admin who sets env-vars) — see XeroIntegration.',
  },
  {
    pathSuffix: 'pages/settings.tsx',
    banned: 'LEADBYTE_API_KEY',
    reason: 'Role-gated to owner (the deploy admin who sets env-vars) — see LeadByteIntegration.',
  },
];

function isExempt(path: string, banned: string): boolean {
  // Normalize both directions so the suffix match works regardless of OS.
  const normalised = path.replace(/\\/g, '/');
  return EXEMPTIONS.some((e) => normalised.endsWith(e.pathSuffix) && e.banned === banned);
}

describe('OCT-45 / OCT-53 — no env-var or hosting-platform names in operator-visible strings', () => {
  for (const banned of BANNED) {
    it(`no source file under src/ references "${banned}"`, () => {
      const offenders: Array<{ path: string; line: number; text: string }> = [];
      for (const [path, content] of Object.entries(sources)) {
        if (isTestPath(path)) continue;
        if (isExempt(path, banned)) continue;
        const lines = content.split(/\r?\n/);
        lines.forEach((text, i) => {
          if (text.includes(banned)) {
            offenders.push({ path, line: i + 1, text: text.trim() });
          }
        });
      }
      // Empty array gives a clean assertion failure; the offender list is
      // serialized into the message so the developer sees exactly where the
      // leak re-entered without re-running the grep manually.
      expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
    });
  }
});
