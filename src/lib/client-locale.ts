// Sam feedback 2026-09-29 (M5 / M7): non-UK clients couldn't be set up
// properly. One place for everything that depends on the client's country:
// currency, VAT treatment, postcode format, phone prefix and the local
// company-number field. The backend (Sato-Backend#49) only rejects input that
// can't be a phone number or postcode anywhere; the per-country checks live
// here so a country we have no format for still saves.

export const VAT_TREATMENTS = ['uk_standard', 'uk_zero_rated', 'reverse_charge', 'outside_scope'] as const;
export type VatTreatment = (typeof VAT_TREATMENTS)[number];

export const VAT_TREATMENT_LABELS: Record<VatTreatment, string> = {
  uk_standard: 'UK VAT (charged on invoices)',
  uk_zero_rated: 'UK zero-rated (0%)',
  reverse_charge: 'Reverse charge (no VAT on invoice)',
  outside_scope: 'Outside the scope of VAT',
};

export const VAT_TREATMENT_HINTS: Record<VatTreatment, string> = {
  uk_standard: 'A VAT line is added to every invoice at the VAT rate below.',
  uk_zero_rated: 'Invoices carry no VAT and go to Xero as zero-rated.',
  reverse_charge: 'Invoices carry no VAT. The client accounts for it in their own country.',
  outside_scope: 'Invoices carry no VAT. Use for clients outside the UK and EU.',
};

/** Same mapping as the backend's vatFlagsFor(): kept in step so older readers agree. */
export function vatFlagsFor(t: VatTreatment): { vatRegistered: boolean; addVatToInvoices: boolean } {
  switch (t) {
    case 'uk_standard': return { vatRegistered: true, addVatToInvoices: true };
    case 'uk_zero_rated': return { vatRegistered: true, addVatToInvoices: false };
    case 'reverse_charge': return { vatRegistered: true, addVatToInvoices: false };
    case 'outside_scope': return { vatRegistered: false, addVatToInvoices: false };
  }
}

/** Treatment for a record that predates vat_treatment. Mirrors the backend's deriveVatTreatment(). */
export function deriveVatTreatment(
  stored: string | null | undefined,
  addVatToInvoices: boolean | null | undefined,
  vatRegistered: boolean | null | undefined,
): VatTreatment {
  if (stored && (VAT_TREATMENTS as readonly string[]).includes(stored)) return stored as VatTreatment;
  if (addVatToInvoices) return 'uk_standard';
  return vatRegistered ? 'uk_zero_rated' : 'outside_scope';
}

export const chargesVat = (t: VatTreatment) => t === 'uk_standard';

// ─── Currencies ──────────────────────────────────────────────────────────────

export const CURRENCIES = [
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'CHF', label: 'CHF (Fr.)' },
  { code: 'PLN', label: 'PLN (zł)' },
  { code: 'SEK', label: 'SEK (kr)' },
  { code: 'DKK', label: 'DKK (kr)' },
  { code: 'NOK', label: 'NOK (kr)' },
  { code: 'AUD', label: 'AUD (A$)' },
  { code: 'CAD', label: 'CAD (C$)' },
  { code: 'AED', label: 'AED (د.إ)' },
  { code: 'CZK', label: 'CZK (Kč)' },
  { code: 'HUF', label: 'HUF (Ft)' },
  { code: 'RON', label: 'RON (lei)' },
] as const;

/** Currency options, plus the record's own code if it isn't in the list (never silently changed on save). */
export function currencyOptions(current?: string | null): Array<{ code: string; label: string }> {
  const base: Array<{ code: string; label: string }> = CURRENCIES.map((c) => ({ ...c }));
  if (current && !base.some((c) => c.code === current)) base.push({ code: current, label: current });
  return base;
}

// ─── Countries ───────────────────────────────────────────────────────────────

export interface CountryProfile {
  code: string; // ISO 3166-1 alpha-2
  name: string; // stored in clients.address_country (the backend's UK check matches these names)
  /** Dial prefixes without the "+". First is the primary one. */
  dial: string[];
  currency: string;
  vat: VatTreatment;
  postcode?: { re: RegExp; example: string };
  /** Label + example for the local company register number (clients.company_number, max 20 chars). */
  companyId: { label: string; placeholder: string };
  vatNumberPlaceholder: string;
  phonePlaceholder: string;
  addressPlaceholders: { line: string; town: string; county: string };
  /** EU member state (reverse charge applies to B2B supplies from the UK). */
  eu?: boolean;
  /** No local rules known: nothing is suggested and only the lenient checks apply. */
  generic?: boolean;
}

const eu = (
  code: string, name: string, dial: string, postcode: CountryProfile['postcode'],
  companyId: CountryProfile['companyId'], vatNumberPlaceholder: string,
  addressPlaceholders: CountryProfile['addressPlaceholders'], currency = 'EUR',
): CountryProfile => ({
  code, name, dial: [dial], currency, vat: 'reverse_charge', postcode, companyId,
  vatNumberPlaceholder, phonePlaceholder: `+${dial} …`, addressPlaceholders, eu: true,
});


const GENERIC_TEXT = {
  companyId: { label: 'Company registration number', placeholder: 'Local company number' },
  vatNumberPlaceholder: 'Local VAT / tax number',
  phonePlaceholder: '+… (with country code)',
  addressPlaceholders: { line: 'Street and number', town: 'Town / City', county: 'Region' },
};

/** EU member with no postcode format on file. */
const euBasic = (
  code: string, name: string, dial: string, companyLabel: string, companyPlaceholder: string,
  vatNumberPlaceholder: string, currency = 'EUR',
): CountryProfile => ({
  code, name, dial: [dial], currency, vat: 'reverse_charge', eu: true,
  companyId: { label: companyLabel, placeholder: companyPlaceholder },
  vatNumberPlaceholder, phonePlaceholder: `+${dial} …`,
  addressPlaceholders: GENERIC_TEXT.addressPlaceholders,
});

export const COUNTRY_PROFILES: CountryProfile[] = [
  {
    code: 'GB', name: 'United Kingdom', dial: ['44'], currency: 'GBP', vat: 'uk_standard',
    postcode: { re: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, example: 'EC4Y 1AA' },
    companyId: { label: 'Company Number (Companies House)', placeholder: '12345678' },
    vatNumberPlaceholder: 'GB123456789', phonePlaceholder: '+44 20 1234 5678',
    addressPlaceholders: { line: '10 Fleet Street', town: 'London', county: 'Greater London' },
  },
  {
    code: 'CH', name: 'Switzerland', dial: ['41'], currency: 'CHF', vat: 'outside_scope',
    postcode: { re: /^\d{4}$/, example: '8001' },
    companyId: { label: 'UID (Swiss company number)', placeholder: 'CHE-123.456.789' },
    vatNumberPlaceholder: 'CHE-123.456.789 MWST', phonePlaceholder: '+41 44 668 18 00',
    addressPlaceholders: { line: 'Bahnhofstrasse 1', town: 'Zürich', county: 'ZH' },
  },
  {
    code: 'IE', name: 'Ireland', dial: ['353'], currency: 'EUR', vat: 'reverse_charge', eu: true,
    postcode: { re: /^([AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}$/i, example: 'D02 X285' },
    companyId: { label: 'CRO number (Irish company number)', placeholder: '123456' },
    vatNumberPlaceholder: 'IE1234567T', phonePlaceholder: '+353 1 234 5678',
    addressPlaceholders: { line: '1 Grafton Street', town: 'Dublin', county: 'Dublin' },
  },
  {
    code: 'PL', name: 'Poland', dial: ['48'], currency: 'PLN', vat: 'reverse_charge', eu: true,
    postcode: { re: /^\d{2}-\d{3}$/, example: '00-950' },
    companyId: { label: 'KRS / NIP (Polish company number)', placeholder: '0000123456' },
    vatNumberPlaceholder: 'PL1234567890', phonePlaceholder: '+48 22 123 45 67',
    addressPlaceholders: { line: 'ul. Marszałkowska 1', town: 'Warszawa', county: 'Mazowieckie' },
  },
  eu('DE', 'Germany', '49', { re: /^\d{5}$/, example: '10115' },
    { label: 'Handelsregister number (HRB)', placeholder: 'HRB 123456' }, 'DE123456789',
    { line: 'Friedrichstraße 1', town: 'Berlin', county: 'Berlin' }),
  eu('FR', 'France', '33', { re: /^\d{5}$/, example: '75001' },
    { label: 'SIREN number', placeholder: '123 456 789' }, 'FR12345678901',
    { line: '1 rue de Rivoli', town: 'Paris', county: 'Île-de-France' }),
  eu('NL', 'Netherlands', '31', { re: /^\d{4}\s?[A-Z]{2}$/i, example: '1012 AB' },
    { label: 'KvK number', placeholder: '12345678' }, 'NL123456789B01',
    { line: 'Damrak 1', town: 'Amsterdam', county: 'Noord-Holland' }),
  eu('BE', 'Belgium', '32', { re: /^\d{4}$/, example: '1000' },
    { label: 'Enterprise number (KBO/BCE)', placeholder: '0123.456.789' }, 'BE0123456789',
    { line: 'Rue de la Loi 1', town: 'Brussels', county: 'Brussels' }),
  eu('ES', 'Spain', '34', { re: /^\d{5}$/, example: '28001' },
    { label: 'CIF / NIF', placeholder: 'A12345678' }, 'ESA12345678',
    { line: 'Calle Mayor 1', town: 'Madrid', county: 'Madrid' }),
  eu('IT', 'Italy', '39', { re: /^\d{5}$/, example: '00184' },
    { label: 'Codice fiscale / Partita IVA', placeholder: '12345678901' }, 'IT12345678901',
    { line: 'Via Roma 1', town: 'Roma', county: 'RM' }),
  eu('PT', 'Portugal', '351', { re: /^\d{4}-\d{3}$/, example: '1000-001' },
    { label: 'NIPC', placeholder: '123456789' }, 'PT123456789',
    { line: 'Rua Augusta 1', town: 'Lisboa', county: 'Lisboa' }),
  eu('AT', 'Austria', '43', { re: /^\d{4}$/, example: '1010' },
    { label: 'Firmenbuchnummer (FN)', placeholder: 'FN 123456a' }, 'ATU12345678',
    { line: 'Stephansplatz 1', town: 'Wien', county: 'Wien' }),
  eu('SE', 'Sweden', '46', { re: /^\d{3}\s?\d{2}$/, example: '111 22' },
    { label: 'Organisationsnummer', placeholder: '556016-0680' }, 'SE556016068001',
    { line: 'Drottninggatan 1', town: 'Stockholm', county: 'Stockholm' }, 'SEK'),
  eu('DK', 'Denmark', '45', { re: /^\d{4}$/, example: '1050' },
    { label: 'CVR number', placeholder: '12345678' }, 'DK12345678',
    { line: 'Strøget 1', town: 'København', county: 'Hovedstaden' }, 'DKK'),
  {
    code: 'NO', name: 'Norway', dial: ['47'], currency: 'NOK', vat: 'outside_scope',
    postcode: { re: /^\d{4}$/, example: '0150' },
    companyId: { label: 'Organisasjonsnummer', placeholder: '123 456 789' },
    vatNumberPlaceholder: 'NO123456789MVA', phonePlaceholder: '+47 22 12 34 56',
    addressPlaceholders: { line: 'Karl Johans gate 1', town: 'Oslo', county: 'Oslo' },
  },
  {
    code: 'US', name: 'United States', dial: ['1'], currency: 'USD', vat: 'outside_scope',
    postcode: { re: /^\d{5}(-\d{4})?$/, example: '10001' },
    companyId: { label: 'EIN', placeholder: '12-3456789' },
    vatNumberPlaceholder: 'Not applicable', phonePlaceholder: '+1 212 555 0100',
    addressPlaceholders: { line: '1 Broadway', town: 'New York', county: 'NY' },
  },
  {
    code: 'CA', name: 'Canada', dial: ['1'], currency: 'CAD', vat: 'outside_scope',
    postcode: { re: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i, example: 'M5V 3L9' },
    companyId: { label: 'Business Number (BN)', placeholder: '123456789' },
    vatNumberPlaceholder: 'Not applicable', phonePlaceholder: '+1 416 555 0100',
    addressPlaceholders: { line: '1 Yonge Street', town: 'Toronto', county: 'ON' },
  },
  {
    code: 'AU', name: 'Australia', dial: ['61'], currency: 'AUD', vat: 'outside_scope',
    postcode: { re: /^\d{4}$/, example: '2000' },
    companyId: { label: 'ABN', placeholder: '12 345 678 901' },
    vatNumberPlaceholder: 'Not applicable', phonePlaceholder: '+61 2 1234 5678',
    addressPlaceholders: { line: '1 George Street', town: 'Sydney', county: 'NSW' },
  },
  {
    code: 'AE', name: 'United Arab Emirates', dial: ['971'], currency: 'AED', vat: 'outside_scope',
    // No postcodes in the UAE.
    companyId: { label: 'Trade licence number', placeholder: '123456' },
    vatNumberPlaceholder: 'Not applicable', phonePlaceholder: '+971 4 123 4567',
    addressPlaceholders: { line: 'Sheikh Zayed Road', town: 'Dubai', county: 'Dubai' },
  },
  // Remaining EU members: no postcode format (lenient check), but the right suggestion.
  euBasic('FI', 'Finland', '358', 'Business ID (Y-tunnus)', '1234567-8', 'FI12345678'),
  euBasic('GR', 'Greece', '30', 'GEMI number', '123456789000', 'EL123456789'),
  euBasic('LU', 'Luxembourg', '352', 'RCS number', 'B123456', 'LU12345678'),
  euBasic('SK', 'Slovakia', '421', 'IČO', '12345678', 'SK1234567890'),
  euBasic('SI', 'Slovenia', '386', 'Registration number', '1234567000', 'SI12345678'),
  euBasic('EE', 'Estonia', '372', 'Registry code', '12345678', 'EE123456789'),
  euBasic('LV', 'Latvia', '371', 'Registration number', '40003012345', 'LV40003012345'),
  euBasic('LT', 'Lithuania', '370', 'Company code', '123456789', 'LT123456789012'),
  euBasic('MT', 'Malta', '356', 'Company number (C)', 'C 12345', 'MT12345678'),
  euBasic('CY', 'Cyprus', '357', 'Registration number (HE)', 'HE 123456', 'CY12345678A'),
  euBasic('HR', 'Croatia', '385', 'OIB / MBS', '12345678901', 'HR12345678901'),
  euBasic('BG', 'Bulgaria', '359', 'UIC (EIK)', '123456789', 'BG123456789'),
  euBasic('CZ', 'Czechia', '420', 'IČO', '12345678', 'CZ12345678', 'CZK'),
  euBasic('HU', 'Hungary', '36', 'Company registration number', '01-09-123456', 'HU12345678', 'HUF'),
  euBasic('RO', 'Romania', '40', 'CUI', '12345678', 'RO12345678', 'RON'),
  // Crown dependencies bill in sterling and are outside UK VAT's reach for B2B.
  ...[['IM', 'Isle of Man', '44'], ['JE', 'Jersey', '44'], ['GG', 'Guernsey', '44']].map(([code, name, dial]) => ({
    code, name, dial: [dial], currency: 'GBP', vat: 'outside_scope' as VatTreatment, ...GENERIC_TEXT,
  })),
];

/** Other ISO 3166-1 alpha-2 codes. No local formats: they fall back to the lenient checks. */
const OTHER_ISO_CODES =
  'AF AL DZ AS AD AO AI AQ AG AR AM AW AZ BS BH BD BB BY BZ BJ BM BT BO BA BW BV BR IO BN BG BF BI KH CM CV KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CY CZ DJ DM DO EC EG SV GQ ER EE ET FK FO FJ FI GF PF TF GA GM GE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IM IL JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NC NZ NI NE NG NU NF MK MP OM PK PW PS PA PG PY PE PH PN PR QA RE RO RU RW SH KN LC PM VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA GS SS LK SD SR SJ SZ SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA UM UY UZ VU VE VN VG VI WF EH YE ZM ZW'.split(' ');

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Every country the picker offers: the profiled ones first-class, the rest from ISO 3166. */
export const COUNTRIES: CountryProfile[] = (() => {
  const known = new Set(COUNTRY_PROFILES.map((c) => c.code));
  const others: CountryProfile[] = OTHER_ISO_CODES.filter((c) => !known.has(c)).map((code) => ({
    code, name: regionName(code), dial: [], currency: 'USD', vat: 'outside_scope' as VatTreatment, generic: true, ...GENERIC_TEXT,
  }));
  return [...COUNTRY_PROFILES, ...others].sort((a, b) => a.name.localeCompare(b.name));
})();

const ALIASES: Record<string, string> = {
  uk: 'GB', gb: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB',
  usa: 'US', 'united states of america': 'US', uae: 'AE', holland: 'NL', 'republic of ireland': 'IE',
  schweiz: 'CH', suisse: 'CH', polska: 'PL', deutschland: 'DE',
};

/** Match the free-text country stored on a client to a profile. Unrecognised text returns undefined. */
export function findCountry(stored: string | null | undefined): CountryProfile | undefined {
  const v = (stored ?? '').trim().toLowerCase();
  if (!v) return undefined;
  const code = ALIASES[v] ?? v.toUpperCase();
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES.find((c) => c.name.toLowerCase() === v);
}

export function isUkCountry(stored: string | null | undefined): boolean {
  const v = (stored ?? '').trim();
  return v === '' || findCountry(v)?.code === 'GB';
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function phoneProblem(raw: string, country?: CountryProfile): string | null {
  // 0041 44 … is the same number as +41 44 …
  const trimmed = raw.trim();
  const v = /^00\d/.test(trimmed) ? `+${trimmed.slice(2)}` : trimmed;
  if (v === '') return null;
  if (!/^\+?[\d\s().-]+$/.test(v)) return 'Phone numbers can only contain digits, spaces and + ( ) . -';
  const digits = v.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return 'Phone number must have 7 to 15 digits.';
  if (!country || country.dial.length === 0) return null;
  const primary = country.dial[0];
  // UK staff type national numbers (020 …, 07…) all day; those stay valid.
  if (!v.startsWith('+') && country.code === 'GB' && v.startsWith('0')) return null;
  if (!v.startsWith('+')) return `Start with the country code, e.g. +${primary} ${country.phonePlaceholder.replace(/^\+\d+\s?/, '')}`.trim();
  const international = digits;
  if (!country.dial.some((d) => international.startsWith(d))) {
    return `${country.name} numbers start with +${country.dial.join(' or +')}.`;
  }
  return null;
}

export function postcodeProblem(raw: string, country?: CountryProfile): string | null {
  const v = raw.trim();
  if (v === '') return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,8}[A-Za-z0-9]$/.test(v)) {
    return 'Postcode can only contain letters, numbers, spaces and hyphens.';
  }
  if (country?.postcode && !country.postcode.re.test(v)) {
    return `Not a valid ${country.name} postcode, e.g. ${country.postcode.example}.`;
  }
  return null;
}

export function companyNumberProblem(raw: string): string | null {
  return raw.trim().length > 20 ? 'Company number can be at most 20 characters.' : null;
}

export interface LocaleFields {
  country: string;
  postcode: string;
  companyNumber: string;
  contactPhones: string[];
}

/** Per-field errors for the client forms. Keys: postcode, companyNumber, phone-<index>. */
export function validateLocale(f: LocaleFields): Record<string, string> {
  const country = findCountry(f.country);
  const errors: Record<string, string> = {};
  const pc = postcodeProblem(f.postcode, country);
  if (pc) errors.postcode = pc;
  const cn = companyNumberProblem(f.companyNumber);
  if (cn) errors.companyNumber = cn;
  f.contactPhones.forEach((p, i) => {
    const msg = phoneProblem(p, country);
    if (msg) errors[`phone-${i}`] = msg;
  });
  return errors;
}

/**
 * What to fill in when the country changes (only fields the user hasn't set themselves).
 * The VAT rate is deliberately not touched: it only applies to UK VAT, and a 0 left
 * behind would silently zero-rate the client if someone switched back to UK VAT.
 */
export function defaultsForCountry(country: CountryProfile) {
  return {
    currency: country.currency,
    vatTreatment: country.vat,
  };
}
