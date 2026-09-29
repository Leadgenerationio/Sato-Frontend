// Sam feedback 2026-09-29 (M5) — country-aware checks for New / Edit Client.
import { describe, it, expect } from 'vitest';
import { findCountry, defaultsForCountry, checkPhone, checkPostcode, COUNTRIES } from '../lib/client-locale';
import { currencyOptions } from '../lib/currencies';
import { resolveVatTreatment } from '../lib/vat-treatment';

const ch = findCountry('Switzerland')!;
const gb = findCountry('United Kingdom')!;
const pl = findCountry('Poland')!;
const ie = findCountry('Ireland')!;

describe('findCountry', () => {
  it('matches names, codes and free-text aliases in existing rows', () => {
    expect(findCountry('switzerland')?.code).toBe('CH');
    expect(findCountry('UK')?.code).toBe('GB');
    expect(findCountry('England')?.code).toBe('GB');
    expect(findCountry('PL')?.code).toBe('PL');
    expect(findCountry('Narnia')).toBeUndefined();
    expect(findCountry('')).toBeUndefined();
  });

  it('covers every EU / EEA country plus UK, CH, US and AE', () => {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    for (const c of ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH','US','AE']) {
      expect(codes.has(c), c).toBe(true);
    }
  });
});

describe('defaultsForCountry', () => {
  it('UK → GBP + UK VAT, Switzerland → CHF + reverse charge, US → USD + outside scope', () => {
    expect(defaultsForCountry(gb)).toEqual({ currency: 'GBP', vatTreatment: 'uk_standard' });
    expect(defaultsForCountry(ch)).toEqual({ currency: 'CHF', vatTreatment: 'reverse_charge' });
    expect(defaultsForCountry(pl)).toEqual({ currency: 'PLN', vatTreatment: 'reverse_charge' });
    expect(defaultsForCountry(findCountry('United States')!)).toEqual({ currency: 'USD', vatTreatment: 'outside_scope' });
  });
});

describe('checkPhone', () => {
  it('errors on junk and short numbers', () => {
    expect(checkPhone('not-a-phone ###', ch).error).toBeTruthy();
    expect(checkPhone('+41 44', ch).error).toBeTruthy();
  });
  it('accepts a matching international number', () => {
    expect(checkPhone('+41 44 668 18 00', ch)).toEqual({});
    expect(checkPhone('0041 44 668 18 00', ch)).toEqual({});
    expect(checkPhone('+353 1 234 5678', ie)).toEqual({});
    expect(checkPhone('+48 22 123 45 67', pl)).toEqual({});
  });
  it('asks non-UK clients for the country code, accepts UK national format', () => {
    expect(checkPhone('044 668 18 00', ch).error).toMatch(/\+41/);
    expect(checkPhone('020 7946 0958', gb)).toEqual({});
  });
  it('warns, not errors, on a different country code', () => {
    const r = checkPhone('+44 20 7946 0958', ch);
    expect(r.error).toBeUndefined();
    expect(r.warning).toMatch(/United Kingdom number/);
  });
  it('empty is fine', () => {
    expect(checkPhone('', ch)).toEqual({});
  });
});

describe('checkPostcode', () => {
  it('rejects junk everywhere', () => {
    expect(checkPostcode('!!!!!!!!', ch).error).toBeTruthy();
    expect(checkPostcode('!!!!!!!!', undefined).error).toBeTruthy();
  });
  it('checks local formats', () => {
    expect(checkPostcode('8001', ch)).toEqual({});
    expect(checkPostcode('80011', ch).error).toMatch(/8001/);
    expect(checkPostcode('00-950', pl)).toEqual({});
    expect(checkPostcode('00950', pl).error).toBeTruthy();
    expect(checkPostcode('D02 X285', ie)).toEqual({});
    expect(checkPostcode('EC4Y 1AA', gb)).toEqual({});
    expect(checkPostcode('ec4y1aa', gb)).toEqual({});
    expect(checkPostcode('12345', gb).error).toBeTruthy();
  });
  it('warns for countries without postcodes', () => {
    expect(checkPostcode('00000', findCountry('United Arab Emirates')).warning).toBeTruthy();
  });
});

describe('currencyOptions / resolveVatTreatment', () => {
  it('keeps an unlisted stored currency selectable', () => {
    expect(currencyOptions('HUF')[0].code).toBe('HUF');
    expect(currencyOptions('GBP').map((c) => c.code)).not.toContain('HUF');
  });
  it('resolves legacy flags like the backend backfill', () => {
    expect(resolveVatTreatment({ addVatToInvoices: true, vatRegistered: true })).toBe('uk_standard');
    expect(resolveVatTreatment({ addVatToInvoices: false, vatRegistered: true })).toBe('uk_zero_rated');
    expect(resolveVatTreatment({ addVatToInvoices: false, vatRegistered: false })).toBe('outside_scope');
    expect(resolveVatTreatment({ vatTreatment: 'reverse_charge', addVatToInvoices: true })).toBe('reverse_charge');
  });
});
