import { describe, it, expect } from 'vitest';
import {
  COUNTRIES, CURRENCIES, findCountry, phoneProblem, postcodeProblem, validateLocale,
  vatFlagsFor, deriveVatTreatment, defaultsForCountry, isUkCountry, currencyOptions,
} from '../lib/client-locale';

const ch = findCountry('CH')!;
const pl = findCountry('Poland')!;
const ie = findCountry('ie')!;

describe('client-locale (Sam M5)', () => {
  it('offers CHF and PLN, and a full country list', () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual(expect.arrayContaining(['GBP', 'EUR', 'USD', 'CHF', 'PLN']));
    expect(COUNTRIES.length).toBeGreaterThan(200);
    expect(COUNTRIES.map((c) => c.name)).toEqual(expect.arrayContaining(['Switzerland', 'Ireland', 'Poland', 'United Kingdom']));
  });

  it('finds a country from the free text already stored on a client', () => {
    expect(findCountry('United Kingdom')?.code).toBe('GB');
    expect(findCountry('UK')?.code).toBe('GB');
    expect(findCountry('  switzerland ')?.code).toBe('CH');
    expect(findCountry('Narnia')).toBeUndefined();
    expect(findCountry('')).toBeUndefined();
    expect(isUkCountry('England')).toBe(true);
    expect(isUkCountry('Poland')).toBe(false);
  });

  it('suggests the local currency and VAT treatment', () => {
    expect(defaultsForCountry(ch)).toEqual({ currency: 'CHF', vatTreatment: 'outside_scope' });
    expect(defaultsForCountry(pl)).toEqual({ currency: 'PLN', vatTreatment: 'reverse_charge' });
    expect(defaultsForCountry(ie)).toEqual({ currency: 'EUR', vatTreatment: 'reverse_charge' });
    expect(defaultsForCountry(findCountry('GB')!)).toEqual({ currency: 'GBP', vatTreatment: 'uk_standard' });
  });

  it('rejects junk phone numbers and wrong country prefixes', () => {
    expect(phoneProblem('not-a-phone ###', ch)).toMatch(/digits/);
    expect(phoneProblem('+41 44 668 18 00', ch)).toBeNull();
    expect(phoneProblem('+44 20 1234 5678', ch)).toMatch(/\+41/);
    expect(phoneProblem('+353 1 234 5678', ie)).toBeNull();
    expect(phoneProblem('+48 22 123 45 67', pl)).toBeNull();
    expect(phoneProblem('044 668 18 00', ch)).toMatch(/country code/);
    expect(phoneProblem('12', ch)).toMatch(/7 to 15/);
    expect(phoneProblem('', ch)).toBeNull();
  });

  it('still accepts UK national numbers and unknown countries', () => {
    const gb = findCountry('GB');
    expect(phoneProblem('020 1234 5678', gb)).toBeNull();
    expect(phoneProblem('07700 900123', gb)).toBeNull();
    expect(phoneProblem('+1 415 555 0100', undefined)).toBeNull();
  });

  it('checks postcodes against the local format', () => {
    expect(postcodeProblem('!!!!!!!!', ch)).toMatch(/letters, numbers/);
    expect(postcodeProblem('8001', ch)).toBeNull();
    expect(postcodeProblem('EC4Y 1AA', ch)).toMatch(/Switzerland/);
    expect(postcodeProblem('00-950', pl)).toBeNull();
    expect(postcodeProblem('00950', pl)).toMatch(/Poland/);
    expect(postcodeProblem('D02 X285', ie)).toBeNull();
    expect(postcodeProblem('EC4Y 1AA', findCountry('GB'))).toBeNull();
    expect(postcodeProblem('anything-1', undefined)).toBeNull();
    // UAE has no postcodes: blank is fine
    expect(postcodeProblem('', findCountry('AE'))).toBeNull();
  });

  it('collects per-field errors', () => {
    const errors = validateLocale({
      country: 'CH', postcode: '!!!!!!!!', companyNumber: 'x'.repeat(21), contactPhones: ['+41 44 668 18 00', 'not-a-phone ###'],
    });
    expect(Object.keys(errors).sort()).toEqual(['companyNumber', 'phone-1', 'postcode']);
  });

  it('maps VAT treatment to the legacy flags exactly like the backend', () => {
    expect(vatFlagsFor('uk_standard')).toEqual({ vatRegistered: true, addVatToInvoices: true });
    expect(vatFlagsFor('uk_zero_rated')).toEqual({ vatRegistered: true, addVatToInvoices: false });
    expect(vatFlagsFor('reverse_charge')).toEqual({ vatRegistered: true, addVatToInvoices: false });
    expect(vatFlagsFor('outside_scope')).toEqual({ vatRegistered: false, addVatToInvoices: false });
  });

  it('derives a treatment for records without one', () => {
    expect(deriveVatTreatment('reverse_charge', false, false)).toBe('reverse_charge');
    expect(deriveVatTreatment(null, true, true)).toBe('uk_standard');
    expect(deriveVatTreatment(undefined, false, true)).toBe('uk_zero_rated');
    expect(deriveVatTreatment(undefined, false, false)).toBe('outside_scope');
    expect(deriveVatTreatment('nonsense', false, false)).toBe('outside_scope');
  });

  it('keeps a stored currency that is not in the list', () => {
    expect(currencyOptions('HUF').map((c) => c.code)).toContain('HUF');
    expect(currencyOptions('GBP').filter((c) => c.code === 'GBP')).toHaveLength(1);
  });
});
