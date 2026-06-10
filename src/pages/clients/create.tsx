import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateClient, type ClientContactInput, type ContactType } from '@/lib/hooks/use-clients';
import { useLbBuyers } from '@/lib/hooks/use-leadbyte';

import { logError } from '../../lib/log';

// Statto form field wrapper — label + control (+ optional hint), matching
// the design's <Field> helper.
function Field({
  label, req, children, hint,
}: {
  label?: React.ReactNode;
  req?: boolean;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="nc-field">
      {(label || req) && <label className="nc-label">{label}{req && <span className="req"> *</span>}</label>}
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
    vatRegistered: false,
    addVatToInvoices: false,
    vatNumber: '',
    vatRate: 20,
    leadPrice: 0,
    billingWorkflow: 'weekly_auto',
    leadbyteClientId: '',
    endoleCompanyId: '',
    xeroContactId: '',
    notes: '',
  });

  // Default: jump straight into the Send Agreement dialog after creation.
  // Sam's #1 ask was making this an "error free" single-flow onboarding —
  // staff who skip this step are the source of most missed agreements.
  const [sendAgreementAfter, setSendAgreementAfter] = useState(true);

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const primary = contacts.find((c) => c.contactType === 'primary');
    if (!form.companyName || !primary || !primary.name || !primary.email) {
      toast.error('Please fill in company name + primary contact name + email');
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
            <Field label="Company Name" req>
              <input className="nc-input" value={form.companyName} onChange={(e) => update('companyName', e.target.value)} placeholder="Acme Ltd" />
            </Field>
            <Field label="Company Number">
              <input className="nc-input" value={form.companyNumber} onChange={(e) => update('companyNumber', e.target.value)} placeholder="12345678" />
            </Field>
          </div>
          <Field label="Address Line">
            <input className="nc-input" value={form.addressLine} onChange={(e) => update('addressLine', e.target.value)} placeholder="10 Fleet Street" />
          </Field>
          <div className="nc-grid2">
            <Field label="Town / City">
              <input className="nc-input" value={form.addressTown} onChange={(e) => update('addressTown', e.target.value)} placeholder="London" />
            </Field>
            <Field label="County">
              <input className="nc-input" value={form.addressCounty} onChange={(e) => update('addressCounty', e.target.value)} placeholder="Greater London" />
            </Field>
            <Field label="Country">
              <input className="nc-input" value={form.addressCountry} onChange={(e) => update('addressCountry', e.target.value)} placeholder="United Kingdom" />
            </Field>
            <Field label="Postcode">
              <input className="nc-input" value={form.addressPostcode} onChange={(e) => update('addressPostcode', e.target.value)} placeholder="EC4Y 1AA" />
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
              <Field label="Type">
                <div className="nc-select-wrap">
                  <select
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
                <Field label={<span>Name {c.contactType === 'primary' && '*'}</span>}>
                  <input className="nc-input" value={c.name} onChange={(e) => updateContact(idx, { name: e.target.value })} placeholder="Jamie Roberts" />
                </Field>
                <Field label="Role / Title">
                  <input className="nc-input" value={c.role} onChange={(e) => updateContact(idx, { role: e.target.value })} placeholder="National Sales Director" />
                </Field>
                <Field label={<span>Email {c.contactType === 'primary' && '*'}</span>}>
                  <input className="nc-input" type="email" value={c.email} onChange={(e) => updateContact(idx, { email: e.target.value })} placeholder="jamie@uken.co.uk" />
                </Field>
                <Field label="Phone">
                  <input className="nc-input" value={c.phone} onChange={(e) => updateContact(idx, { phone: e.target.value })} placeholder="+44 20 1234 5678" />
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

        <div className="grid-1-2 nc-row">
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Billing Settings</h3>
            <div className="nc-grid3">
              <Field label="Currency">
                <div className="nc-select-wrap">
                  <select className="nc-select" value={form.currency} onChange={(e) => update('currency', e.target.value)}>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
              <Field label="Payment Terms">
                <div className="nc-select-wrap">
                  <select className="nc-select" value={form.paymentTermsDays} onChange={(e) => update('paymentTermsDays', Number(e.target.value))}>
                    <option value={4}>4 days (Mon issue → Fri due)</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
              <Field label="Lead Price">
                <input className="nc-input" type="number" min={0} step={0.01} value={form.leadPrice} onChange={(e) => update('leadPrice', Number(e.target.value))} />
              </Field>
            </div>
            <div className="nc-grid2" style={{ marginTop: 4 }}>
              <Field label="VAT Registered">
                <label className="nc-check">
                  <input type="checkbox" checked={form.vatRegistered} onChange={(e) => { update('vatRegistered', e.target.checked); update('addVatToInvoices', e.target.checked); }} />
                  <span className="nc-check-box"><Check className="size-[13px]" strokeWidth={3} /></span>
                  <span>Charge VAT on invoices</span>
                </label>
              </Field>
              <Field label="Billing Workflow">
                <div className="nc-select-wrap">
                  <select className="nc-select" value={form.billingWorkflow} onChange={(e) => update('billingWorkflow', e.target.value)}>
                    <option value="weekly_auto">Weekly Auto</option>
                    <option value="monthly_validated">Monthly Validated</option>
                    <option value="custom">Custom</option>
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
            </div>
            {form.vatRegistered && (
              <div className="nc-grid2">
                <Field label="VAT Number">
                  <input className="nc-input" value={form.vatNumber} onChange={(e) => update('vatNumber', e.target.value)} placeholder="GB123456789" />
                </Field>
                <Field label="VAT Rate (%)">
                  <input className="nc-input" type="number" min={0} max={100} step={0.01} value={form.vatRate} onChange={(e) => update('vatRate', Number(e.target.value))} />
                </Field>
              </div>
            )}
          </div>

          <div className="card pad acard">
            <h3 className="statto-title nc-h">External IDs</h3>
            <p className="ac-sub" style={{ marginTop: 0, marginBottom: 16 }}>Optional — link this client to external systems. Leave blank if unknown; you can fill in later.</p>
            <Field label="LeadByte Buyer">
              <LeadByteBuyerSelect value={form.leadbyteClientId} onChange={(v) => update('leadbyteClientId', v)} />
            </Field>
            <Field label="Companies House number">
              <input className="nc-input" value={form.endoleCompanyId} onChange={(e) => update('endoleCompanyId', e.target.value)} placeholder="UK Companies House number used for credit checks" />
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
              {sendAgreementAfter && (
                // Sam #27: he hit "no agreement to send" because nothing was
                // uploaded yet. Make the prereq visible inline so staff know
                // what the dialog will need.
                <>
                  <br />
                  <span className="nc-foot-sub">You'll need an agreement PDF ready to upload, or this dialog will be empty.</span>
                </>
              )}
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
