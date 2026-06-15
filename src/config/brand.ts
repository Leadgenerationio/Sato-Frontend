// ─── Brand configuration ────────────────────────────────────────────────────
//
// Client-appropriate, configurable branding for the login screen (Sam ask
// 2026-06-15: drop the internal "Stato" wordmark + generic marketing copy and
// present the client's own brand). Defaults target leadgeneration.io so the
// login reads e.g. "leadgeneration.io — Client portal".
//
// Override per-deployment via Vite env vars (set in Vercel / .env):
//   VITE_BRAND_NAME      — brand wordmark text (default "leadgeneration.io")
//   VITE_BRAND_TAGLINE   — short tagline (default "Client portal")
//   VITE_BRAND_LOGO_URL  — optional logo image URL; when set the login shows
//                          the image instead of the brand-name text.
//
// To set the leadgeneration.io logo, host the logo (e.g. in the public/ folder
// or on a CDN) and set VITE_BRAND_LOGO_URL to its URL, for example:
//   VITE_BRAND_LOGO_URL=https://leadgeneration.io/assets/logo.svg
//
// NOTE (infra TODO): the login domain / subdomain (e.g. portal.leadgeneration.io)
// is configured separately in Vercel (domains + DNS) by the team — it is NOT
// handled here in code.

const env = import.meta.env as Record<string, string | undefined>;

export interface BrandConfig {
  name: string;
  tagline: string;
  logoUrl: string | null;
}

export const brand: BrandConfig = {
  name: env.VITE_BRAND_NAME || 'leadgeneration.io',
  tagline: env.VITE_BRAND_TAGLINE || 'Client portal',
  logoUrl: env.VITE_BRAND_LOGO_URL || null,
};
