import { clientStatusLabel } from '@/lib/client-status';
import { vatTreatmentLabel, type VatTreatment } from '@/lib/vat-treatment';

// Feedback S3 (Sam, 29 Sep 2026): the Activity timeline said
// "Sam updated companyName, companyNumber, addressLine, … xeroContactId" on
// every save. The backend now logs only fields that really changed, with
// `diff: { field: { from, to } }`; this turns that into readable lines such
// as "VAT Registered: No → Yes".

const FIELD_LABELS: Record<string, string> = {
  companyName: 'Company name',
  companyNumber: 'Company number',
  contactName: 'Contact name',
  contactEmail: 'Contact email',
  contactPhone: 'Contact phone',
  address: 'Address',
  addressLine: 'Address line',
  addressTown: 'Town / city',
  addressCounty: 'County / region',
  addressCountry: 'Country',
  addressPostcode: 'Postcode',
  currency: 'Currency',
  paymentTermsDays: 'Payment terms (days)',
  vatRegistered: 'VAT Registered',
  addVatToInvoices: 'Add VAT to invoices',
  vatNumber: 'VAT number',
  vatRate: 'VAT rate (%)',
  vatTreatment: 'VAT treatment',
  leadPrice: 'Lead price',
  clientType: 'Client type',
  billingWorkflow: 'Billing workflow',
  onboardingStatus: 'Onboarding status',
  status: 'Client status',
  notes: 'Notes',
  leadbyteClientId: 'LeadByte buyer',
  endoleCompanyId: 'Companies House number (credit checks)',
  xeroContactId: 'Xero contact',
  agreementSigned: 'Agreement signed',
  contacts: 'Contacts',
};

export function activityFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (field === 'status') return clientStatusLabel(String(v));
  if (field === 'vatTreatment') return vatTreatmentLabel(v as VatTreatment);
  if (field === 'clientType') return v === 'managed' ? 'Managed' : v === 'ppl' ? 'Pay per lead' : String(v);
  if (field === 'billingWorkflow' || field === 'onboardingStatus') return String(v).replace(/_/g, ' ');
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
  if (typeof v === 'object') return 'updated';
  const s = String(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

export interface ActivityDiffLine { field: string; label: string; from: string; to: string }

/** `{ vatRegistered: { from: false, to: true } }` → [{ label: 'VAT Registered', from: 'No', to: 'Yes' }]. */
export function formatActivityDiff(diff: unknown): ActivityDiffLine[] {
  if (!diff || typeof diff !== 'object' || Array.isArray(diff)) return [];
  return Object.entries(diff as Record<string, unknown>)
    .filter(([, change]) => !!change && typeof change === 'object' && ('from' in (change as object) || 'to' in (change as object)))
    .map(([field, change]) => {
      const c = change as { from?: unknown; to?: unknown };
      return { field, label: activityFieldLabel(field), from: formatValue(field, c.from), to: formatValue(field, c.to) };
    });
}
