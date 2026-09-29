import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateClient, type ClientContactInput, type ContactType } from '@/lib/hooks/use-clients';
import { useLbBuyers } from '@/lib/hooks/use-leadbyte';
import {
  findCountry, defaultsForCountry, checkPhone, checkPostcode, companyIdLabel,
  phonePlaceholder, postcodePlaceholder, type FieldCheck,
} from '@/lib/client-locale';
import { VAT_TREATMENT_OPTIONS, type VatTreatment } from '@/lib/vat-treatment';
import { CountrySelect, CurrencySelect, VatTreatmentSelect, FieldMessage } from '@/components/clients/client-locale-fields';

import { logError } from '../../lib/log';

// Statto form field wrapper — label + control (+ optional hint), matching
// the design's <Field> helper.
function Field({
  label, req, children, hint, htmlFor,
}: {
  label?: React.ReactNode;
  req?: boolean;
  children: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="nc-field">
      {(label || req) && <label className="nc-label" htmlFor={htmlFor}>{label}{req && <span className="req"> *</span>}</label>}
      {children}
      {hint && <span className="nc-hint">{hint}</span>}
    </div>
  );
}

export function ClientCreatePage() {
  const navigate = useNavigate();
  const createClient = useCreateClient();

  // Sam's Loom #17: a real client (e.g. UK Energy Saving Network) has several
  // contacts — primary, billing, compliance, sometimes more. Start with one
  // empty primary row; staff can add more as needed.
  const [contacts, setContacts] = useState<ClientContactInput[]>([
    { contactType: 'primary', name: '', email: '', phone: '', role: '' },
  ]);

  function updateContact(idx: number, patch: Partial<ClientContactInput>) {
    setContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function addContact(type: ContactType) {
    setContacts((prev) => [...prev, { contactType: type, name: '', email: '', phone: '', role: '' }]);
  }
  function removeContact(idx: number) {
    setContacts((prev) => prev.filter((_, i) => i !== idx));
  }

  const [form, setForm] = useState({
    companyName: '',
    companyNumber: '',
    addressLine: '',
    addressTown: '',
    addressCounty: '',
    addressCountry: 'United Kingdom',
    addressPostcode: '',
    currency: 'GBP',
    paymentTermsDays: 30,
    // M5/S4 (Sam feedback 2026-09-29) — one VAT treatment instead of a tick
    // that silently set two different settings. The backend derives the
    // legacy vatRegistered / addVatToInvoices flags from it.
    vatTreatment: 'uk_standard' as VatTreatment,
    vatNumber: '',
    vatRate: 20,
    leadPrice: 0,
    billingWorkflow: 'weekly_auto',
    leadbyteClientId: '',
    endoleCompanyId: '',
    xeroContactId: '',
    notes: '',
  });

  // S5 (Sam feedback 2026-09-29): this opens the Send Agreement dialog on
  // the new client's page (detail.tsx reads ?send-agreement=1). It is not
  // part of the save itself, so it now defaults OFF — ticking it is a
  // conscious "take me to the agreement next".
  const [sendAgreementAfter, setSendAgreementAfter] = useState(false);

  // M5 — country drives defaults, labels, placeholders and validation.
  const country = findCountry(form.addressCountry);
  const isUk = country?.code === 'GB';
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const touch = (key: string) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  const shown = (key: string, check: FieldCheck): FieldCheck | undefined =>
    submitted || touched[key] ? check : undefined;

  const checks = useMemo(() => ({
    postcode: checkPostcode(form.addressPostcode, country),
    phones: contacts.map((c) => checkPhone(c.phone, country)),
  }), [form.addressPostcode, contacts, country]);
  const hasBlockingError = !!checks.postcode.error || checks.phones.some((c) => !!c.error);

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Picking a country pre-fills its billing currency and VAT treatment. The
  // user can still change either afterwards.
  function handleCountryChange(name: string) {
    const next = findCountry(name);
    setForm((prev) => ({
      ...prev,
      addressCountry: name,
      ...(next ? defaultsForCountry(next) : {}),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const primary = contacts.find((c) => c.contactType === 'primary');
    if (!form.companyName || !primary || !primary.name || !primary.email) {
      toast.error('Please fill in company name + primary contact name + email');
      return;
    }
    if (hasBlockingError) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    try {
      const client = await createClient.mutateAsync({ ...form, contacts });
      // Backend fires credit check fire-and-forget; surface that to staff so
      // they don't think nothing happened.
      toast.success(
        client.companyNumber
          ? `${client.companyName} created — credit check running`
          : `${client.companyName} created`,
      );
      const nextUrl = sendAgreementAfter
        ? `/clients/${client.id}?send-agreement=1`
        : `/clients/${client.id}`;
      navigate(nextUrl);
    } catch (err) {
      logError('Create client failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create client');
    }
  }

  return (
    <div className="screen-page nc-page">
      <div className="page-head">
        <div className="nc-title-row">
          <button type="button" className="nc-back" onClick={() => navigate('/clients')} title="Back to clients"><ArrowLeft className="size-5" /></button>
          <div>
            <h1 className="ahead-title">New Client</h1>
            <p className="ahead-sub">Add a new client to Stato</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="screen-page" style={{ padding: 0 }}>
        <div className="card pad acard">
          <h3 className="statto-title nc-h">Company Information</h3>
          <div className="nc-grid2">
            <Field label="Company Name" req htmlFor="nc-company-name">
              <input id="nc-company-name" className="nc-input" value={form.companyName} onChange={(e) => update('companyName', e.target.value)} placeholder="Acme Ltd" />
            </Field>
            {/* N3 — this is clients.company_number: the number the credit
                check and Xero contact matching use. Label follows the country
                (Companies House / CRO / UID / KRS…). */}
            <Field label={companyIdLabel(country)} htmlFor="nc-company-number" hint={isUk ? 'Used for credit checks and Xero matching' : undefined}>
              <input id="nc-company-number" className="nc-input" maxLength={20} value={form.companyNumber} onChange={(e) => update('companyNumber', e.target.value)} placeholder={country?.companyIdPlaceholder ?? ''} />
            </Field>
          </div>
          <Field label="Address Line" htmlFor="nc-address-line">
            <input id="nc-address-line" className="nc-input" value={form.addressLine} onChange={(e) => update('addressLine', e.target.value)} placeholder={isUk ? '10 Fleet Street' : 'Street and number'} />
          </Field>
          <div className="nc-grid2">
            <Field label="Town / City" htmlFor="nc-town">
              <input id="nc-town" className="nc-input" value={form.addressTown} onChange={(e) => update('addressTown', e.target.value)} placeholder={isUk ? 'London' : ''} />
            </Field>
            <Field label={country?.regionLabel ?? 'Region'} htmlFor="nc-region">
              <input id="nc-region" className="nc-input" value={form.addressCounty} onChange={(e) => update('addressCounty', e.target.value)} placeholder={isUk ? 'Greater London' : ''} />
            </Field>
          </div>
          {/* Address order (Yash review): line → town + county → postcode + country. */}
          <div className="nc-grid2">
            <Field label="Postcode" htmlFor="nc-postcode">
              <input
                id="nc-postcode"
                className="nc-input"
                value={form.addressPostcode}
                onChange={(e) => update('addressPostcode', e.target.value)}
                onBlur={() => touch('postcode')}
                placeholder={postcodePlaceholder(country)}
                aria-invalid={!!shown('postcode', checks.postcode)?.error}
                aria-describedby="nc-postcode-msg"
              />
              <FieldMessage id="nc-postcode-msg" check={shown('postcode', checks.postcode)} />
            </Field>
            <Field label="Country" htmlFor="nc-country" hint={country && !isUk ? `Currency and VAT set for ${country.name} — change below if needed.` : undefined}>
              <div className="nc-select-wrap">
                <CountrySelect id="nc-country" className="nc-select" value={form.addressCountry} onChange={handleCountryChange} />
                <ChevronDown className="size-[15px]" />
              </div>
            </Field>
          </div>
        </div>

        <div className="card pad acard">
          <h3 className="statto-title nc-h">Contacts</h3>
          <p className="ac-sub" style={{ marginTop: 0, marginBottom: 18 }}>One primary contact required. Add billing or compliance contacts as needed.</p>
          {contacts.map((c, idx) => (
            <div key={idx} className="nc-contact">
              {idx > 0 && (
                <button type="button" className="nc-contact-x" onClick={() => removeContact(idx)} title="Remove contact"><X className="size-[15px]" /></button>
              )}
              <Field label="Type" htmlFor={`nc-contact-type-${idx}`}>
                <div className="nc-select-wrap">
                  <select
                    id={`nc-contact-type-${idx}`}
                    className="nc-select"
                    value={c.contactType}
                    onChange={(e) => updateContact(idx, { contactType: e.target.value as ContactType })}
                    disabled={idx === 0}
                  >
                    <option value="primary">Primary</option>
                    <option value="billing">Billing</option>
                    <option value="compliance">Compliance</option>
                    <option value="other">Other</option>
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
              <div className="nc-grid2">
                <Field label={<span>Name {c.contactType === 'primary' && '*'}</span>} htmlFor={`nc-contact-name-${idx}`}>
                  <input id={`nc-contact-name-${idx}`} className="nc-input" value={c.name} onChange={(e) => updateContact(idx, { name: e.target.value })} placeholder="Jamie Roberts" />
                </Field>
                <Field label="Role / Title" htmlFor={`nc-contact-role-${idx}`}>
                  <input id={`nc-contact-role-${idx}`} className="nc-input" value={c.role} onChange={(e) => updateContact(idx, { role: e.target.value })} placeholder="National Sales Director" />
                </Field>
                <Field label={<span>Email {c.contactType === 'primary' && '*'}</span>} htmlFor={`nc-contact-email-${idx}`}>
                  <input id={`nc-contact-email-${idx}`} className="nc-input" type="email" value={c.email} onChange={(e) => updateContact(idx, { email: e.target.value })} placeholder={isUk ? 'jamie@uken.co.uk' : 'name@company.com'} />
                </Field>
                <Field label="Phone" htmlFor={`nc-phone-${idx}`}>
                  <input
                    id={`nc-phone-${idx}`}
                    className="nc-input"
                    type="tel"
                    value={c.phone}
                    onChange={(e) => updateContact(idx, { phone: e.target.value })}
                    onBlur={() => touch(`phone-${idx}`)}
                    placeholder={phonePlaceholder(country)}
                    aria-invalid={!!shown(`phone-${idx}`, checks.phones[idx] ?? {})?.error}
                    aria-describedby={`nc-phone-${idx}-msg`}
                  />
                  <FieldMessage id={`nc-phone-${idx}-msg`} check={shown(`phone-${idx}`, checks.phones[idx] ?? {})} />
                </Field>
              </div>
            </div>
          ))}
          <div className="nc-add-row">
            <button type="button" className="btn b-ghost b-sm" onClick={() => addContact('billing')}><Plus className="size-[15px]" /> Add billing contact</button>
            <button type="button" className="btn b-ghost b-sm" onClick={() => addContact('compliance')}><Plus className="size-[15px]" /> Add compliance contact</button>
            <button type="button" className="btn b-ghost b-sm" onClick={() => addContact('other')}><Plus className="size-[15px]" /> Add other</button>
          </div>
        </div>

        {/* Billing and External IDs share the row equally: at 1fr/1.6fr the
            Billing card was too narrow and cut off "GBP (£)" / "30 days". */}
        <div className="nc-row nc-billing-row">
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Billing Settings</h3>
            <div className="nc-grid2">
              <Field label="Currency" htmlFor="nc-currency">
                <div className="nc-select-wrap">
                  <CurrencySelect id="nc-currency" className="nc-select" value={form.currency} onChange={(v) => update('currency', v)} />
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
              <Field label="Payment Terms" htmlFor="nc-terms">
                <div className="nc-select-wrap">
                  <select id="nc-terms" className="nc-select" value={form.paymentTermsDays} onChange={(e) => update('paymentTermsDays', Number(e.target.value))}>
                    <option value={4}>4 days (Mon issue → Fri due)</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
            </div>
            {/* Full row — the treatment labels are long. */}
            <Field
              label="VAT treatment"
              htmlFor="nc-vat-treatment"
              hint={VAT_TREATMENT_OPTIONS.find((o) => o.value === form.vatTreatment)?.hint}
            >
              <div className="nc-select-wrap">
                <VatTreatmentSelect id="nc-vat-treatment" className="nc-select" value={form.vatTreatment} onChange={(v) => update('vatTreatment', v)} />
                <ChevronDown className="size-[15px]" />
              </div>
            </Field>
            <div className="nc-grid2" style={{ marginTop: 4 }}>
              <Field label="Billing Workflow" htmlFor="nc-billing-workflow">
                <div className="nc-select-wrap">
                  <select id="nc-billing-workflow" className="nc-select" value={form.billingWorkflow} onChange={(e) => update('billingWorkflow', e.target.value)}>
                    <option value="weekly_auto">Weekly Auto</option>
                    <option value="monthly_validated">Monthly Validated</option>
                    <option value="custom">Custom</option>
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
              <Field label="Lead Price" htmlFor="nc-lead-price">
                <input id="nc-lead-price" className="nc-input" type="number" min={0} step={0.01} value={form.leadPrice} onChange={(e) => update('leadPrice', Number(e.target.value))} />
              </Field>
            </div>
            {form.vatTreatment !== 'outside_scope' && (
              <div className="nc-grid2">
                <Field label="VAT Number" htmlFor="nc-vat-number">
                  <input id="nc-vat-number" className="nc-input" value={form.vatNumber} onChange={(e) => update('vatNumber', e.target.value)} placeholder={country?.vatNumberPlaceholder ?? 'VAT / tax number'} />
                </Field>
                {form.vatTreatment === 'uk_standard' && (
                  <Field label="VAT Rate (%)" htmlFor="nc-vat-rate">
                    <input id="nc-vat-rate" className="nc-input" type="number" min={0} max={100} step={0.01} value={form.vatRate} onChange={(e) => update('vatRate', Number(e.target.value))} />
                  </Field>
                )}
              </div>
            )}
          </div>

          <div className="card pad acard">
            <h3 className="statto-title nc-h">External IDs</h3>
            <p className="ac-sub" style={{ marginTop: 0, marginBottom: 16 }}>Optional — link this client to external systems. Leave blank if unknown; you can fill in later.</p>
            <Field label="LeadByte Buyer">
              <LeadByteBuyerSelect value={form.leadbyteClientId} onChange={(v) => update('leadbyteClientId', v)} />
            </Field>
            {/* N3 (Sam feedback 2026-09-29): this was labelled "Companies House
                number" but it's clients.endole_company_id — the credit
                provider's own record id, written back after a check. The
                registration number the check uses is the field above. */}
            <Field label="Credit check provider ID (Endole)" hint="Filled in automatically after the first credit check. Leave blank.">
              <input className="nc-input" value={form.endoleCompanyId} onChange={(e) => update('endoleCompanyId', e.target.value)} placeholder="Set after credit check" />
            </Field>
            <Field label="Xero Contact ID">
              <input className="nc-input" value={form.xeroContactId} onChange={(e) => update('xeroContactId', e.target.value)} placeholder="Populated after Xero sync" />
            </Field>
          </div>
        </div>

        <div className="card pad acard">
          <h3 className="statto-title nc-h">Notes</h3>
          <textarea
            className="nc-textarea"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Any notes about this client…"
          />
        </div>

        <div className="nc-foot">
          <button type="submit" className="btn b-dark" disabled={createClient.isPending}>
            {createClient.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Create Client
          </button>
          <label className="nc-check">
            <input
              type="checkbox"
              checked={sendAgreementAfter}
              onChange={(e) => setSendAgreementAfter(e.target.checked)}
            />
            <span className="nc-check-box"><Check className="size-[13px]" strokeWidth={3} /></span>
            <span className="nc-foot-text">
              <strong>Send agreement immediately after creation</strong>
              <br />
              {/* S5 — plain wording: what ticking it actually does. */}
              <span className="nc-foot-sub">
                After saving, open the Send Agreement step for this client. You'll need the agreement PDF ready.
              </span>
            </span>
          </label>
        </div>
      </form>
    </div>
  );
}

// Sam #26: replace the free-text LeadByte client id input with a dropdown
// fed by /api/v1/leadbyte/buyers so staff don't have to memorise (or
// fat-finger) the LeadByte buyer id.
function LeadByteBuyerSelect({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: buyers, isLoading, isError } = useLbBuyers('Active');
  const options = (buyers ?? []).slice().sort((a, b) => (a.company ?? '').localeCompare(b.company ?? ''));

  if (isLoading) {
    return <p className="nc-hint">Loading buyers from LeadByte…</p>;
  }
  if (isError) {
    // Fallback to text input so a LeadByte outage doesn't block client creation.
    return (
      <>
        <input className="nc-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. lb-1" />
        <span className="nc-hint" style={{ color: 'var(--warning)' }}>LeadByte unreachable — entering buyer id manually.</span>
      </>
    );
  }
  if (options.length === 0) {
    return (
      <>
        <input className="nc-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. lb-1" />
        <span className="nc-hint">No active LeadByte buyers found — enter id manually.</span>
      </>
    );
  }
  return (
    <div className="nc-select-wrap">
      <select className="nc-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select a buyer…</option>
        {options.map((b) => {
          const id = String(b.id ?? b.bid ?? '');
          return (
            <option key={id || b.company} value={id}>
              {b.company}{b.bid ? ` · ${b.bid}` : id ? ` · ${id}` : ''}
            </option>
          );
        })}
      </select>
      <ChevronDown className="size-[15px]" />
    </div>
  );
}
