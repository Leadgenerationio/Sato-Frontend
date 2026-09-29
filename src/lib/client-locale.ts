// Sam feedback 2026-09-29 (M5): "Clients outside the UK can't be set up
// correctly". Country was free text defaulting to "United Kingdom" (the
// Polish client Sonova is stored as UK), every placeholder was British, the
// only company-ID field was Companies House, and nothing checked phone or
// postcode input.
//
// This table drives the New Client / Edit Client forms: picking a country
// sets the default currency, VAT treatment, phone prefix, postcode format
// and the local company-ID label. The country is still STORED BY NAME in
// clients.address_country — existing rows, the agreement address resolver
// and the Xero/credit-check code all read the name, so switching the column
// to an ISO code would mean a data migration of free-text values for no
// user-visible gain. The code here is only used to look the name up.

import type { VatTreatment } from './vat-treatment';

export interface CountryInfo {
  code: string;
  name: string;
  /** International dialling code, digits only (no "+"). */
  dial: string;
  /**
   * Default BILLING currency: the local currency when it's one we invoice in
   * (see currencies.ts), otherwise EUR for Europe and USD elsewhere. Always
   * editable on the form.
   */
  currency: string;
  /** Postcode format; omitted = no local check (a lenient generic one applies). */
  postcode?: { re: RegExp; example: string };
  /** true = the country has no postcodes at all. */
  noPostcode?: boolean;
  companyIdLabel?: string;
  companyIdPlaceholder?: string;
  vatNumberPlaceholder?: string;
  regionLabel?: string;
  /** EU / EEA / CH — B2B supplies default to reverse charge. */
  europe?: boolean;
}

const D4 = { re: /^\d{4}$/, example: '8001' };
const D5 = { re: /^\d{5}$/, example: '10115' };

// UK first, then Europe (Sam bills CH / IE / PL today), then the rest A–Z.
export const COUNTRIES: CountryInfo[] = [
  {
    code: 'GB', name: 'United Kingdom', dial: '44', currency: 'GBP',
    postcode: { re: /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|GIR ?0AA)$/i, example: 'EC4Y 1AA' },
    companyIdLabel: 'Companies House number', companyIdPlaceholder: '12345678',
    vatNumberPlaceholder: 'GB123456789', regionLabel: 'County',
  },
  {
    code: 'IE', name: 'Ireland', dial: '353', currency: 'EUR', europe: true,
    postcode: { re: /^[A-Z][0-9W][0-9W] ?[A-Z0-9]{4}$/i, example: 'D02 X285' },
    companyIdLabel: 'CRO number', companyIdPlaceholder: '123456',
    vatNumberPlaceholder: 'IE1234567T', regionLabel: 'County',
  },
  {
    code: 'CH', name: 'Switzerland', dial: '41', currency: 'CHF', europe: true, postcode: D4,
    companyIdLabel: 'UID (company ID)', companyIdPlaceholder: 'CHE-123.456.789',
    vatNumberPlaceholder: 'CHE-123.456.789 MWST', regionLabel: 'Canton',
  },
  {
    code: 'PL', name: 'Poland', dial: '48', currency: 'PLN', europe: true,
    postcode: { re: /^\d{2}-\d{3}$/, example: '00-950' },
    companyIdLabel: 'KRS or NIP number', companyIdPlaceholder: '0000123456',
    vatNumberPlaceholder: 'PL1234567890', regionLabel: 'Voivodeship',
  },
  { code: 'AT', name: 'Austria', dial: '43', currency: 'EUR', europe: true, postcode: { re: /^\d{4}$/, example: '1010' }, companyIdLabel: 'Firmenbuch number', vatNumberPlaceholder: 'ATU12345678', regionLabel: 'State' },
  { code: 'BE', name: 'Belgium', dial: '32', currency: 'EUR', europe: true, postcode: { re: /^\d{4}$/, example: '1000' }, companyIdLabel: 'Enterprise number (KBO/BCE)', companyIdPlaceholder: '0123.456.789', vatNumberPlaceholder: 'BE0123456789', regionLabel: 'Province' },
  { code: 'BG', name: 'Bulgaria', dial: '359', currency: 'EUR', europe: true, postcode: { re: /^\d{4}$/, example: '1000' }, vatNumberPlaceholder: 'BG123456789' },
  { code: 'HR', name: 'Croatia', dial: '385', currency: 'EUR', europe: true, postcode: D5, vatNumberPlaceholder: 'HR12345678901' },
  { code: 'CY', name: 'Cyprus', dial: '357', currency: 'EUR', europe: true, postcode: { re: /^\d{4}$/, example: '1010' }, vatNumberPlaceholder: 'CY12345678X' },
  { code: 'CZ', name: 'Czechia', dial: '420', currency: 'CZK', europe: true, postcode: { re: /^\d{3} ?\d{2}$/, example: '110 00' }, companyIdLabel: 'IČO', companyIdPlaceholder: '12345678', vatNumberPlaceholder: 'CZ12345678' },
  { code: 'DK', name: 'Denmark', dial: '45', currency: 'DKK', europe: true, postcode: { re: /^\d{4}$/, example: '1050' }, companyIdLabel: 'CVR number', companyIdPlaceholder: '12345678', vatNumberPlaceholder: 'DK12345678' },
  { code: 'EE', name: 'Estonia', dial: '372', currency: 'EUR', europe: true, postcode: D5, vatNumberPlaceholder: 'EE123456789' },
  { code: 'FI', name: 'Finland', dial: '358', currency: 'EUR', europe: true, postcode: { re: /^\d{5}$/, example: '00100' }, companyIdLabel: 'Business ID (Y-tunnus)', companyIdPlaceholder: '1234567-8', vatNumberPlaceholder: 'FI12345678' },
  { code: 'FR', name: 'France', dial: '33', currency: 'EUR', europe: true, postcode: { re: /^\d{5}$/, example: '75001' }, companyIdLabel: 'SIREN', companyIdPlaceholder: '123 456 789', vatNumberPlaceholder: 'FR12345678901', regionLabel: 'Region' },
  { code: 'DE', name: 'Germany', dial: '49', currency: 'EUR', europe: true, postcode: D5, companyIdLabel: 'Handelsregister number', companyIdPlaceholder: 'HRB 12345', vatNumberPlaceholder: 'DE123456789', regionLabel: 'State' },
  { code: 'GR', name: 'Greece', dial: '30', currency: 'EUR', europe: true, postcode: { re: /^\d{3} ?\d{2}$/, example: '105 57' }, vatNumberPlaceholder: 'EL123456789' },
  { code: 'HU', name: 'Hungary', dial: '36', currency: 'EUR', europe: true, postcode: { re: /^\d{4}$/, example: '1051' }, vatNumberPlaceholder: 'HU12345678' },
  { code: 'IS', name: 'Iceland', dial: '354', currency: 'EUR', europe: true, postcode: { re: /^\d{3}$/, example: '101' } },
  { code: 'IT', name: 'Italy', dial: '39', currency: 'EUR', europe: true, postcode: { re: /^\d{5}$/, example: '00118' }, companyIdLabel: 'REA / Partita IVA', vatNumberPlaceholder: 'IT12345678901', regionLabel: 'Province' },
  { code: 'LV', name: 'Latvia', dial: '371', currency: 'EUR', europe: true, postcode: { re: /^(LV-)?\d{4}$/i, example: 'LV-1050' }, vatNumberPlaceholder: 'LV12345678901' },
  { code: 'LI', name: 'Liechtenstein', dial: '423', currency: 'CHF', europe: true, postcode: { re: /^\d{4}$/, example: '9490' } },
  { code: 'LT', name: 'Lithuania', dial: '370', currency: 'EUR', europe: true, postcode: { re: /^(LT-)?\d{5}$/i, example: 'LT-01100' }, vatNumberPlaceholder: 'LT123456789' },
  { code: 'LU', name: 'Luxembourg', dial: '352', currency: 'EUR', europe: true, postcode: { re: /^(L-)?\d{4}$/i, example: 'L-1111' }, companyIdLabel: 'RCS number', companyIdPlaceholder: 'B123456', vatNumberPlaceholder: 'LU12345678' },
  { code: 'MT', name: 'Malta', dial: '356', currency: 'EUR', europe: true, postcode: { re: /^[A-Z]{3} ?\d{4}$/i, example: 'VLT 1117' }, vatNumberPlaceholder: 'MT12345678' },
  { code: 'NL', name: 'Netherlands', dial: '31', currency: 'EUR', europe: true, postcode: { re: /^\d{4} ?[A-Z]{2}$/i, example: '1012 AB' }, companyIdLabel: 'KvK number', companyIdPlaceholder: '12345678', vatNumberPlaceholder: 'NL123456789B01', regionLabel: 'Province' },
  { code: 'NO', name: 'Norway', dial: '47', currency: 'NOK', europe: true, postcode: { re: /^\d{4}$/, example: '0150' }, companyIdLabel: 'Organisation number', companyIdPlaceholder: '123 456 789', vatNumberPlaceholder: 'NO123456789MVA' },
  { code: 'PT', name: 'Portugal', dial: '351', currency: 'EUR', europe: true, postcode: { re: /^\d{4}-\d{3}$/, example: '1000-001' }, companyIdLabel: 'NIPC', vatNumberPlaceholder: 'PT123456789' },
  { code: 'RO', name: 'Romania', dial: '40', currency: 'EUR', europe: true, postcode: { re: /^\d{6}$/, example: '010011' }, vatNumberPlaceholder: 'RO1234567890' },
  { code: 'SK', name: 'Slovakia', dial: '421', currency: 'EUR', europe: true, postcode: { re: /^\d{3} ?\d{2}$/, example: '811 01' }, companyIdLabel: 'IČO', vatNumberPlaceholder: 'SK1234567890' },
  { code: 'SI', name: 'Slovenia', dial: '386', currency: 'EUR', europe: true, postcode: { re: /^\d{4}$/, example: '1000' }, vatNumberPlaceholder: 'SI12345678' },
  { code: 'ES', name: 'Spain', dial: '34', currency: 'EUR', europe: true, postcode: D5, companyIdLabel: 'CIF / NIF', companyIdPlaceholder: 'B12345678', vatNumberPlaceholder: 'ESB12345678', regionLabel: 'Province' },
  { code: 'SE', name: 'Sweden', dial: '46', currency: 'SEK', europe: true, postcode: { re: /^\d{3} ?\d{2}$/, example: '111 22' }, companyIdLabel: 'Organisation number', companyIdPlaceholder: '556123-4567', vatNumberPlaceholder: 'SE123456789001' },
  // Rest of the world, A–Z.
  { code: 'AU', name: 'Australia', dial: '61', currency: 'USD', postcode: { re: /^\d{4}$/, example: '2000' }, companyIdLabel: 'ABN', companyIdPlaceholder: '12 345 678 901', regionLabel: 'State' },
  { code: 'CA', name: 'Canada', dial: '1', currency: 'USD', postcode: { re: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i, example: 'K1A 0B1' }, companyIdLabel: 'Business number', regionLabel: 'Province' },
  { code: 'HK', name: 'Hong Kong', dial: '852', currency: 'USD', noPostcode: true, companyIdLabel: 'CR number' },
  { code: 'IN', name: 'India', dial: '91', currency: 'USD', postcode: { re: /^\d{6}$/, example: '110001' }, companyIdLabel: 'CIN', regionLabel: 'State' },
  { code: 'IL', name: 'Israel', dial: '972', currency: 'USD', postcode: { re: /^\d{7}$/, example: '6100000' } },
  { code: 'NZ', name: 'New Zealand', dial: '64', currency: 'USD', postcode: { re: /^\d{4}$/, example: '6011' }, companyIdLabel: 'NZBN' },
  { code: 'QA', name: 'Qatar', dial: '974', currency: 'USD', noPostcode: true },
  { code: 'SA', name: 'Saudi Arabia', dial: '966', currency: 'USD', postcode: D5 },
  { code: 'SG', name: 'Singapore', dial: '65', currency: 'USD', postcode: { re: /^\d{6}$/, example: '018956' }, companyIdLabel: 'UEN' },
  { code: 'ZA', name: 'South Africa', dial: '27', currency: 'USD', postcode: { re: /^\d{4}$/, example: '8001' }, companyIdLabel: 'CIPC registration number', regionLabel: 'Province' },
  { code: 'TR', name: 'Turkey', dial: '90', currency: 'EUR', postcode: D5 },
  { code: 'AE', name: 'United Arab Emirates', dial: '971', currency: 'AED', noPostcode: true, companyIdLabel: 'Trade licence number', vatNumberPlaceholder: 'TRN 100000000000003', regionLabel: 'Emirate' },
  { code: 'US', name: 'United States', dial: '1', currency: 'USD', postcode: { re: /^\d{5}(-\d{4})?$/, example: '10001' }, companyIdLabel: 'EIN', companyIdPlaceholder: '12-3456789', vatNumberPlaceholder: 'Sales tax ID', regionLabel: 'State' },
];

// Free-text spellings seen in (or likely in) existing rows.
const ALIASES: Record<string, string> = {
  uk: 'GB', gb: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  'northern ireland': 'GB', 'united kingdom of great britain and northern ireland': 'GB',
  'republic of ireland': 'IE', eire: 'IE', 'czech republic': 'CZ', holland: 'NL',
  'the netherlands': 'NL', usa: 'US', 'united states of america': 'US', uae: 'AE',
  schweiz: 'CH', suisse: 'CH', polska: 'PL', deutschland: 'DE',
};

/** Look up a stored country (name, ISO code or common alias). */
export function findCountry(value: string | null | undefined): CountryInfo | undefined {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return undefined;
  const code = ALIASES[v] ?? v.toUpperCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === v || c.code === code);
}

export interface CountryDefaults {
  currency: string;
  vatTreatment: VatTreatment;
}

/**
 * What picking a country pre-fills. Only applied when the user CHANGES the
 * country — loading an existing client never rewrites its currency or VAT.
 * UK → UK VAT; Europe → reverse charge (B2B); elsewhere → outside scope.
 */
export function defaultsForCountry(country: CountryInfo): CountryDefaults {
  return {
    currency: country.currency,
    vatTreatment: country.code === 'GB' ? 'uk_standard' : country.europe ? 'reverse_charge' : 'outside_scope',
  };
}

export function phonePlaceholder(country: CountryInfo | undefined): string {
  if (!country || country.code === 'GB') return '+44 20 1234 5678';
  return `+${country.dial} …`;
}

export interface FieldCheck {
  /** Blocks the save. */
  error?: string;
  /** Shown, but doesn't block (e.g. a UK mobile for a Swiss client's contact). */
  warning?: string;
}

/**
 * Phone check. Must look like a phone number (7–15 digits, only digits and
 * + ( ) - . space). An international number whose country code differs from
 * the client's country gets a warning, not an error — a contact can
 * legitimately sit in another country. A national number (no "+") is fine
 * for UK clients; for anyone else we ask for the country code, since a bare
 * "044 668 18 00" is ambiguous on an invoice or a call list.
 */
export function checkPhone(raw: string, country: CountryInfo | undefined): FieldCheck {
  const v = raw.trim();
  if (!v) return {};
  if (!/^\+?[\d\s().-]+$/.test(v)) {
    return { error: 'Use digits only, with the country code — e.g. ' + (country ? `+${country.dial} …` : '+44 20 1234 5678') };
  }
  const digits = v.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return { error: 'That doesn\'t look like a full phone number (7–15 digits).' };
  }
  const intl = v.startsWith('+') ? digits : v.startsWith('00') ? digits.slice(2) : null;
  if (intl === null) {
    if (!country || country.code === 'GB') return {};
    return { error: `Add the country code — ${country.name} numbers start +${country.dial}.` };
  }
  if (country && !intl.startsWith(country.dial)) {
    const other = COUNTRIES.filter((c) => intl.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length)[0];
    return {
      warning: other
        ? `This is a ${other.name} number (+${other.dial}); the client is in ${country.name} (+${country.dial}).`
        : `${country.name} numbers start +${country.dial}.`,
    };
  }
  return {};
}

/** Postcode check against the country's local format (generic check otherwise). */
export function checkPostcode(raw: string, country: CountryInfo | undefined): FieldCheck {
  const v = raw.trim();
  if (!v) return {};
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,8}[A-Za-z0-9]$/.test(v)) {
    return { error: 'Postcode can only contain letters, numbers, spaces and hyphens.' };
  }
  if (country?.noPostcode) return { warning: `${country.name} doesn't use postcodes — you can leave this blank.` };
  if (country?.postcode && !country.postcode.re.test(v)) {
    return { error: `${country.name} postcodes look like ${country.postcode.example}.` };
  }
  return {};
}

export function postcodePlaceholder(country: CountryInfo | undefined): string {
  if (!country) return '';
  if (country.noPostcode) return 'Not used';
  return country.postcode?.example ?? '';
}

export function companyIdLabel(country: CountryInfo | undefined): string {
  return country?.companyIdLabel ?? 'Company registration number';
}
