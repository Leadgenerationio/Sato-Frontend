// ─── Brand configuration ────────────────────────────────────────────────────
//
// Client-appropriate, configurable branding for the login screen (Sam ask
// 2026-06-15: drop the internal "Stato" wordmark + generic marketing copy and
// present the client's own brand). Defaults target leadgeneration.io so the
// login reads e.g. "leadgeneration.io — Client portal".
//
// Branding is resolved in this priority order:
//   1. Vite env vars (highest — explicit per-deployment / preview override)
//   2. Hostname registry below (per-company subdomain → brand). This is the
//      code half of Sam's "subdomain per company" ask: when a company's
//      subdomain (e.g. leadgeneration.io.stato.com / portal.leadgeneration.io)
//      points at this app, the matching brand shows automatically.
//   3. DEFAULT_BRAND fallback.
//
// Env override vars (set in Vercel / .env):
//   VITE_BRAND_NAME      — brand wordmark text
//   VITE_BRAND_TAGLINE   — short tagline
//   VITE_BRAND_LOGO_URL  — optional logo image URL; when set the login shows
//                          the image instead of the brand-name text.
//
// To set a company's logo, host the logo (public/ folder or a CDN) and either
// set VITE_BRAND_LOGO_URL or add `logoUrl` to its registry entry below, e.g.
//   VITE_BRAND_LOGO_URL=https://leadgeneration.io/assets/logo.svg
//
// NOTE (infra TODO — NOT code): buying the Stato domain, pointing each company
// subdomain's DNS, and adding the domains in Vercel is done separately by the
// team. Once a subdomain resolves to this app, the registry below brands it.

const env = import.meta.env as Record<string, string | undefined>;

export interface BrandConfig {
  name: string;
  tagline: string;
  logoUrl: string | null;
}

export const DEFAULT_BRAND: BrandConfig = {
  name: 'leadgeneration.io',
  tagline: 'Client portal',
  logoUrl: null,
};

// Per-company hostname registry. `match` is tested as a case-insensitive
// substring of the request hostname, so both `leadgeneration.io.stato.com` and
// `portal.leadgeneration.io` resolve to the leadgeneration.io brand. Add a new
// entry per company as more businesses get their own subdomain.
interface BrandRule {
  match: string;
  brand: BrandConfig;
}

export const BRAND_REGISTRY: BrandRule[] = [
  {
    match: 'leadgeneration',
    brand: { name: 'leadgeneration.io', tagline: 'Client portal', logoUrl: null },
  },
];

function envBrand(): BrandConfig | null {
  if (!env.VITE_BRAND_NAME && !env.VITE_BRAND_TAGLINE && !env.VITE_BRAND_LOGO_URL) {
    return null;
  }
  return {
    name: env.VITE_BRAND_NAME || DEFAULT_BRAND.name,
    tagline: env.VITE_BRAND_TAGLINE || DEFAULT_BRAND.tagline,
    logoUrl: env.VITE_BRAND_LOGO_URL || null,
  };
}

/**
 * Resolve the active brand for a hostname.
 * Priority: env override → hostname registry → default.
 */
export function resolveBrand(hostname?: string): BrandConfig {
  const override = envBrand();
  if (override) return override;

  const host = (hostname || '').toLowerCase();
  if (host) {
    const rule = BRAND_REGISTRY.find((r) => host.includes(r.match.toLowerCase()));
    if (rule) return rule.brand;
  }
  return DEFAULT_BRAND;
}

export const brand: BrandConfig = resolveBrand(
  typeof window !== 'undefined' ? window.location.hostname : undefined,
);
