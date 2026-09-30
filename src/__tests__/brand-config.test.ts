import { describe, it, expect } from 'vitest';
import { resolveBrand, DEFAULT_BRAND } from '@/config/brand';

// Retest R2 / N1 (30 Sep 2026): sign-in said "leadgeneration.io" while the app said "Stato".
// With no env override and no registry entry, every hostname reads "Stato".
describe('resolveBrand — one brand by default', () => {
  it('reads Stato on the live host and on other hosts', () => {
    expect(resolveBrand('leadgenerationio.stato.tech').name).toBe('Stato');
    expect(resolveBrand('portal.leadgeneration.io').name).toBe('Stato');
    expect(resolveBrand('some-other-company.stato.com').name).toBe('Stato');
  });

  it('falls back to the default brand when no hostname is given', () => {
    expect(resolveBrand()).toEqual(DEFAULT_BRAND);
    expect(resolveBrand('')).toEqual(DEFAULT_BRAND);
    expect(DEFAULT_BRAND.name).toBe('Stato');
  });
});
