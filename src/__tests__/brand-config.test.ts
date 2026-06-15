import { describe, it, expect } from 'vitest';
import { resolveBrand, DEFAULT_BRAND } from '@/config/brand';

// Fix 10 (2026-06-15): per-company subdomain branding. With no env override set
// in the test env, resolveBrand falls through to the hostname registry / default.
describe('resolveBrand — hostname-based branding', () => {
  it('brands a leadgeneration.io subdomain on stato.com', () => {
    expect(resolveBrand('leadgeneration.io.stato.com').name).toBe('leadgeneration.io');
  });

  it('brands portal.leadgeneration.io', () => {
    const b = resolveBrand('portal.leadgeneration.io');
    expect(b.name).toBe('leadgeneration.io');
    expect(b.tagline).toBe('Client portal');
  });

  it('is case-insensitive on the hostname', () => {
    expect(resolveBrand('Portal.LeadGeneration.IO').name).toBe('leadgeneration.io');
  });

  it('falls back to the default brand for an unknown host', () => {
    expect(resolveBrand('some-other-company.stato.com')).toEqual(DEFAULT_BRAND);
  });

  it('falls back to the default brand when no hostname is given', () => {
    expect(resolveBrand()).toEqual(DEFAULT_BRAND);
    expect(resolveBrand('')).toEqual(DEFAULT_BRAND);
  });
});
