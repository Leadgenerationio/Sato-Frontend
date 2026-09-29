// Sam feedback 2026-09-29 (M5 / S4): one "VAT registered" tick set both
// "VAT registered" and "Add VAT to invoices", and there was no way to set up
// a reverse-charge or outside-scope client. The backend stores one of these
// four values (clients.vat_treatment) and derives the old booleans from it.

export type VatTreatment = 'uk_standard' | 'uk_zero_rated' | 'reverse_charge' | 'outside_scope';

export const VAT_TREATMENT_OPTIONS: { value: VatTreatment; label: string; hint: string }[] = [
  { value: 'uk_standard', label: 'UK VAT (standard rate)', hint: 'VAT is added to every invoice at the rate below.' },
  { value: 'uk_zero_rated', label: 'UK VAT (zero-rated)', hint: 'VAT registered, but invoices carry 0% VAT.' },
  { value: 'reverse_charge', label: 'Reverse charge (EU / international B2B)', hint: 'No VAT on the invoice — the customer accounts for VAT in their country.' },
  { value: 'outside_scope', label: 'No VAT (outside scope)', hint: 'No VAT on the invoice.' },
];

export function vatTreatmentLabel(value: VatTreatment | null | undefined): string {
  return VAT_TREATMENT_OPTIONS.find((o) => o.value === value)?.label ?? 'Not set';
}

/** Only standard-rate UK VAT puts a VAT line on the invoice. */
export function treatmentChargesVat(value: VatTreatment | null | undefined): boolean {
  return value === 'uk_standard';
}

/**
 * Treatment for a client record from an API that predates vat_treatment —
 * the same rule the backend backfill uses.
 */
export function resolveVatTreatment(c: {
  vatTreatment?: VatTreatment | null;
  vatRegistered?: boolean;
  addVatToInvoices?: boolean;
}): VatTreatment {
  if (c.vatTreatment) return c.vatTreatment;
  if (c.addVatToInvoices) return 'uk_standard';
  return c.vatRegistered ? 'uk_zero_rated' : 'outside_scope';
}
