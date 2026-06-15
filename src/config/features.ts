// ─── Feature flags ──────────────────────────────────────────────────────────
//
// Lightweight, build-time feature toggles. Each flag has a sensible default and
// can be overridden per-deployment via a Vite env var (set in Vercel / .env),
// mirroring the brand-config pattern in ./brand.ts.
//
// Env vars are strings, so an override counts as "on" when set to one of
// "1" / "true" / "yes" (case-insensitive) and "off" for "0" / "false" / "no".
// Anything else falls back to the flag's default.
//
//   VITE_FEATURE_CLIENT_ONBOARDING_STRIP — show the "Stage X of 4" onboarding
//     progress strip on the admin client-detail page. Removed from the default
//     UI on 2026-06-15; flip this on to bring it back for a client that wants
//     the onboarding lifecycle surfaced inline above the tabs.
//       VITE_FEATURE_CLIENT_ONBOARDING_STRIP=1

const env = import.meta.env as Record<string, string | undefined>;

function envFlag(name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw == null || raw === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

export interface FeatureFlags {
  /**
   * Admin client-detail onboarding stage strip ("Stage X of 4").
   * Default OFF — set VITE_FEATURE_CLIENT_ONBOARDING_STRIP=1 to re-enable.
   */
  clientOnboardingStrip: boolean;
}

export const features: FeatureFlags = {
  clientOnboardingStrip: envFlag('VITE_FEATURE_CLIENT_ONBOARDING_STRIP', false),
};
