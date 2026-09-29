// Shared New Client / Edit Client controls for Sam's feedback 2026-09-29
// (M5 / S4): an ISO country picker, the full currency list and the VAT
// treatment dropdown. Plain <select>s so they work on phones and in the
// Edit Client dialog without portals.
import { COUNTRIES, findCountry, type FieldCheck } from '@/lib/client-locale';
import { currencyLabel, currencyOptions } from '@/lib/currencies';
import { VAT_TREATMENT_OPTIONS, type VatTreatment } from '@/lib/vat-treatment';

const EUROPE = COUNTRIES.filter((c) => c.code !== 'GB' && c.europe);
const REST = COUNTRIES.filter((c) => c.code !== 'GB' && !c.europe);

interface SelectProps<T extends string> {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Country picker. The stored value is the country NAME (back-compat with
 * existing rows). A stored value we don't recognise ("Narnia", a typo) is
 * kept as its own option, so opening Edit Client never changes it silently.
 */
export function CountrySelect({ value, onChange, ...rest }: SelectProps<string>) {
  const known = findCountry(value);
  const selected = known?.name ?? value;
  return (
    <select {...rest} value={selected} onChange={(e) => onChange(e.target.value)}>
      {!value && <option value="">Select a country…</option>}
      {value && !known && <option value={value}>{value} (not in list — please pick)</option>}
      <option value="United Kingdom">United Kingdom</option>
      <optgroup label="Europe">
        {EUROPE.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
      </optgroup>
      <optgroup label="Rest of the world">
        {REST.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
      </optgroup>
    </select>
  );
}

export function CurrencySelect({ value, onChange, ...rest }: SelectProps<string>) {
  return (
    <select {...rest} value={value} onChange={(e) => onChange(e.target.value)}>
      {currencyOptions(value).map((c) => (
        <option key={c.code} value={c.code}>{currencyLabel(c.code)}</option>
      ))}
    </select>
  );
}

export function VatTreatmentSelect({ value, onChange, ...rest }: SelectProps<VatTreatment>) {
  return (
    <select {...rest} value={value} onChange={(e) => onChange(e.target.value as VatTreatment)}>
      {VAT_TREATMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/**
 * Error (red, blocks save) or warning (amber, informational) under a field.
 * Darker than --negative / --warning on purpose: those read ~2–3.5:1 on white,
 * below the 4.5:1 text minimum (Sam S15).
 */
export function FieldMessage({ check, id }: { check: FieldCheck | undefined; id?: string }) {
  if (check?.error) {
    return <span id={id} role="alert" className="nc-hint" style={{ color: '#b42318' }}>{check.error}</span>;
  }
  if (check?.warning) {
    return <span id={id} className="nc-hint" style={{ color: '#8a5300' }}>{check.warning}</span>;
  }
  return null;
}
