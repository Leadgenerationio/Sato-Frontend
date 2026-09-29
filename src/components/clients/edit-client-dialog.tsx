import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logError } from '../../lib/log';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useUpdateClient,
  useDeleteClient,
  type ClientDetail,
  type ClientContactInput,
  type ContactType,
} from '@/lib/hooks/use-clients';
import {
  findCountry, defaultsForCountry, checkPhone, checkPostcode, companyIdLabel,
  phonePlaceholder, postcodePlaceholder, type FieldCheck,
} from '@/lib/client-locale';
import { resolveVatTreatment, VAT_TREATMENT_OPTIONS } from '@/lib/vat-treatment';
import { CountrySelect, CurrencySelect, VatTreatmentSelect, FieldMessage } from '@/components/clients/client-locale-fields';

const selectClass = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm';

interface EditClientDialogProps {
  client: ClientDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const updateClient = useUpdateClient();

  // Initialise form from the live client object every time the dialog opens.
  // We use a single flat state object mirroring create.tsx so the form is
  // easy to reason about without a form library.
  const [form, setForm] = useState(() => buildFormState(client));
  const [contacts, setContacts] = useState<ClientContactInput[]>(() => buildContactsState(client));

  // Keep local state fresh whenever the dialog re-opens with new client data
  // (e.g. after a parent re-fetch). We reset on every open rather than on
  // every client prop change so mid-edit changes are not lost if the parent
  // re-renders with the same client.
  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(buildFormState(client));
      setContacts(buildContactsState(client));
      setSubmitted(false);
      setTouched({});
    }
    onOpenChange(next);
  }

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // M5 — the country drives labels, placeholders and validation. Defaults
  // (currency, VAT treatment) are applied only when the user CHANGES the
  // country, so opening an existing client (e.g. country "United Kingdom"
  // with EUR billing) never rewrites what's stored.
  const country = findCountry(form.addressCountry);
  const isUk = country?.code === 'GB';
  function handleCountryChange(name: string) {
    const next = findCountry(name);
    setForm((prev) => ({ ...prev, addressCountry: name, ...(next ? defaultsForCountry(next) : {}) }));
  }
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (key: string) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  const shown = (key: string, check: FieldCheck): FieldCheck | undefined =>
    submitted || touched[key] ? check : undefined;
  const checks = useMemo(() => ({
    postcode: checkPostcode(form.addressPostcode, country),
    phones: contacts.map((c) => checkPhone(c.phone, country)),
  }), [form.addressPostcode, contacts, country]);
  const hasBlockingError = !!checks.postcode.error || checks.phones.some((c) => !!c.error);

  function updateContact(idx: number, patch: Partial<ClientContactInput>) {
    setContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function addContact(type: ContactType) {
    setContacts((prev) => [...prev, { contactType: type, name: '', email: '', phone: '', role: '' }]);
  }
  function removeContact(idx: number) {
    setContacts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!form.companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (hasBlockingError) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    // S3 (Sam feedback 2026-09-29): send only what changed, so the Activity
    // log reads "VAT treatment: outside scope → reverse charge" instead of
    // "updated" + all 20 fields. Contacts go only if the set changed.
    const changes = diffForm(buildFormState(client), form);
    const contactsChanged = JSON.stringify(buildContactsState(client)) !== JSON.stringify(contacts);
    if (Object.keys(changes).length === 0 && !contactsChanged) {
      toast.info('No changes to save');
      onOpenChange(false);
      return;
    }
    try {
      await updateClient.mutateAsync({ id: client.id, ...changes, ...(contactsChanged ? { contacts } : {}) });
      toast.success(`${form.companyName} updated`);
      onOpenChange(false);
    } catch (err) {
      logError('Update client failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update client');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* S2 (Sam feedback 2026-09-29): the dialog is a flex column — header
          and Save/Cancel footer stay put, only the fields scroll. Save used to
          sit ~2,640px down on a phone. */}
      <DialogContent
        className="sm:max-w-2xl max-h-[90dvh] flex flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update {client.companyName}'s details. Nothing is saved until you click Save Changes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-2" data-testid="edit-client-body">
          {/* ── Company Information ─────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Company Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                  placeholder="Acme Ltd"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-company-number">{companyIdLabel(country)}</Label>
                <Input
                  id="edit-company-number"
                  maxLength={20}
                  value={form.companyNumber}
                  onChange={(e) => update('companyNumber', e.target.value)}
                  placeholder={country?.companyIdPlaceholder ?? ''}
                />
                {isUk && <p className="text-xs text-muted-foreground">Used for credit checks and Xero matching</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address Line</Label>
              <Input
                value={form.addressLine}
                onChange={(e) => update('addressLine', e.target.value)}
                placeholder={isUk ? '10 Fleet Street' : 'Street and number'}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Town / City</Label>
                <Input
                  value={form.addressTown}
                  onChange={(e) => update('addressTown', e.target.value)}
                  placeholder={isUk ? 'London' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label>{country?.regionLabel ?? 'Region'}</Label>
                <Input
                  value={form.addressCounty}
                  onChange={(e) => update('addressCounty', e.target.value)}
                  placeholder={isUk ? 'Greater London' : ''}
                />
              </div>
            </div>
            {/* Same order as New Client: line → town + county → postcode + country. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-postcode">Postcode</Label>
                <Input
                  id="edit-postcode"
                  value={form.addressPostcode}
                  onChange={(e) => update('addressPostcode', e.target.value)}
                  onBlur={() => touch('postcode')}
                  placeholder={postcodePlaceholder(country)}
                  aria-invalid={!!shown('postcode', checks.postcode)?.error}
                  aria-describedby="edit-postcode-msg"
                />
                <FieldMessage id="edit-postcode-msg" check={shown('postcode', checks.postcode)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-country">Country</Label>
                <CountrySelect id="edit-country" className={selectClass} value={form.addressCountry} onChange={handleCountryChange} />
              </div>
            </div>
          </section>

          {/* ── Status & Workflow ───────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Status &amp; Workflow</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Client Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                  className={selectClass}
                >
                  <option value="onboarding">Onboarding</option>
                  <option value="active">Active</option>
                  {/* M4 (Sam feedback 2026-09-29) — Paused shown as Paused. */}
                  <option value="paused">Paused</option>
                  <option value="churned">Churned</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Onboarding Status</Label>
                <select
                  value={form.onboardingStatus}
                  onChange={(e) => update('onboardingStatus', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="documents_received">Documents Received</option>
                  <option value="agreement_signed">Agreement Signed</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Billing Workflow</Label>
                <select
                  value={form.billingWorkflow}
                  onChange={(e) => update('billingWorkflow', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="weekly_auto">Weekly Auto</option>
                  <option value="monthly_validated">Monthly Validated</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          </section>

          {/* ── Billing Settings ────────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Billing Settings</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edit-currency">Currency</Label>
                <CurrencySelect id="edit-currency" className={selectClass} value={form.currency} onChange={(v) => update('currency', v)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <select
                  value={form.paymentTermsDays}
                  onChange={(e) => update('paymentTermsDays', Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value={4}>4 days (Mon → Fri)</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Lead Price</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.leadPrice}
                  onChange={(e) => update('leadPrice', Number(e.target.value))}
                />
              </div>
            </div>
            {/* M5/S4 — one VAT treatment, same labels as New Client. */}
            <div className="space-y-2">
              <Label htmlFor="edit-vat-treatment">VAT treatment</Label>
              <VatTreatmentSelect id="edit-vat-treatment" className={selectClass} value={form.vatTreatment} onChange={(v) => update('vatTreatment', v)} />
              <p className="text-xs text-muted-foreground">{VAT_TREATMENT_OPTIONS.find((o) => o.value === form.vatTreatment)?.hint}</p>
            </div>
            {form.vatTreatment !== 'outside_scope' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-vat-number">VAT Number</Label>
                  <Input
                    id="edit-vat-number"
                    value={form.vatNumber}
                    onChange={(e) => update('vatNumber', e.target.value)}
                    placeholder={country?.vatNumberPlaceholder ?? 'VAT / tax number'}
                  />
                </div>
                {form.vatTreatment === 'uk_standard' && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-vat-rate">VAT Rate (%)</Label>
                    <Input
                      id="edit-vat-rate"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={form.vatRate}
                      onChange={(e) => update('vatRate', Number(e.target.value))}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Contacts ────────────────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Contacts</h3>
            <p className="text-xs text-muted-foreground">
              One primary contact required. Add billing or compliance contacts as needed.
            </p>
            {contacts.map((c, idx) => (
              <div key={idx} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="space-y-1.5 flex-1">
                    <Label>Type</Label>
                    <select
                      value={c.contactType}
                      onChange={(e) => updateContact(idx, { contactType: e.target.value as ContactType })}
                      disabled={idx === 0}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-60"
                    >
                      <option value="primary">Primary</option>
                      <option value="billing">Billing</option>
                      <option value="compliance">Compliance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {idx > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeContact(idx)}
                      aria-label="Remove contact"
                    >
                      <Trash2 className="size-4 text-red-600" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Name {c.contactType === 'primary' && '*'}</Label>
                    <Input
                      value={c.name}
                      onChange={(e) => updateContact(idx, { name: e.target.value })}
                      placeholder="Jamie Roberts"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role / Title</Label>
                    <Input
                      value={c.role}
                      onChange={(e) => updateContact(idx, { role: e.target.value })}
                      placeholder="National Sales Director"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email {c.contactType === 'primary' && '*'}</Label>
                    <Input
                      type="email"
                      value={c.email}
                      onChange={(e) => updateContact(idx, { email: e.target.value })}
                      placeholder={isUk ? 'jamie@uken.co.uk' : 'name@company.com'}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`edit-phone-${idx}`}>Phone</Label>
                    <Input
                      id={`edit-phone-${idx}`}
                      type="tel"
                      value={c.phone}
                      onChange={(e) => updateContact(idx, { phone: e.target.value })}
                      onBlur={() => touch(`phone-${idx}`)}
                      placeholder={phonePlaceholder(country)}
                      aria-invalid={!!shown(`phone-${idx}`, checks.phones[idx] ?? {})?.error}
                      aria-describedby={`edit-phone-${idx}-msg`}
                    />
                    <FieldMessage id={`edit-phone-${idx}-msg`} check={shown(`phone-${idx}`, checks.phones[idx] ?? {})} />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addContact('billing')}>
                <Plus className="size-4 mr-1.5" />Add billing contact
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addContact('compliance')}>
                <Plus className="size-4 mr-1.5" />Add compliance contact
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addContact('other')}>
                <Plus className="size-4 mr-1.5" />Add other
              </Button>
            </div>
          </section>

          {/* ── External IDs ────────────────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">External IDs</h3>
            <p className="text-xs text-muted-foreground">
              Leave blank to unlink. Changes here do not update the external system — only the Stato record.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>LeadByte Client ID</Label>
                <Input
                  value={form.leadbyteClientId}
                  onChange={(e) => update('leadbyteClientId', e.target.value)}
                  placeholder="e.g. lb-1"
                />
              </div>
              <div className="space-y-2">
                <Label>Xero Contact ID</Label>
                <Input
                  value={form.xeroContactId}
                  onChange={(e) => update('xeroContactId', e.target.value)}
                  placeholder="Populated after Xero sync"
                />
              </div>
            </div>
          </section>

          {/* ── Notes ───────────────────────────────────────────── */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Notes</h3>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Any notes about this client..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </section>

          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateClient.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateClient.isPending}>
              {updateClient.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helper: derive initial form state from a ClientDetail ───────────────────

function buildFormState(client: ClientDetail) {
  return {
    companyName: client.companyName,
    companyNumber: client.companyNumber ?? '',
    addressLine: client.addressLine ?? '',
    addressTown: client.addressTown ?? '',
    addressCounty: client.addressCounty ?? '',
    addressCountry: client.addressCountry ?? 'United Kingdom',
    addressPostcode: client.addressPostcode ?? '',
    currency: client.currency,
    paymentTermsDays: client.paymentTermsDays,
    vatTreatment: resolveVatTreatment(client),
    vatNumber: client.vatNumber ?? '',
    vatRate: client.vatRate,
    leadPrice: client.leadPrice,
    billingWorkflow: client.billingWorkflow,
    onboardingStatus: client.onboardingStatus,
    status: client.status,
    leadbyteClientId: client.leadbyteClientId ?? '',
    xeroContactId: client.xeroContactId ?? '',
    notes: client.notes ?? '',
  };
}

type EditForm = ReturnType<typeof buildFormState>;

/** Only the fields whose value differs from what was loaded (S3). */
export function diffForm(before: EditForm, after: EditForm): Partial<EditForm> {
  const out: Partial<EditForm> = {};
  for (const key of Object.keys(after) as (keyof EditForm)[]) {
    if (String(after[key] ?? '') !== String(before[key] ?? '')) {
      (out as Record<string, unknown>)[key] = after[key];
    }
  }
  return out;
}

function buildContactsState(client: ClientDetail): ClientContactInput[] {
  if (client.contacts.length > 0) {
    return client.contacts.map((c) => ({
      contactType: c.contactType,
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: c.role,
    }));
  }
  // Fallback: seed a primary row from the top-level contact fields
  // (pre-contacts-migration data may have contacts: [] but contactName set).
  return [
    {
      contactType: 'primary',
      name: client.contactName ?? '',
      email: client.contactEmail ?? '',
      phone: client.contactPhone ?? '',
      role: '',
    },
  ];
}

// ─── Convenience trigger component ───────────────────────────────────────────
// Used in detail.tsx to keep the button+state co-located cleanly.

interface EditClientButtonProps {
  client: ClientDetail;
}

export function EditClientButton({ client }: EditClientButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-4 mr-1.5" />
        Edit Client
      </Button>
      <EditClientDialog client={client} open={open} onOpenChange={setOpen} />
    </>
  );
}

// ─── Remove client (owner-only) ──────────────────────────────────────────────
// Hard delete — irreversible. The admin must re-type the company name to arm
// the button, the same guardrail GitHub/Stripe use for destructive deletes.
// Render only for the 'owner' role (gated at the call site in detail.tsx).

interface RemoveClientButtonProps {
  client: ClientDetail;
}

export function RemoveClientButton({ client }: RemoveClientButtonProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const navigate = useNavigate();
  const deleteClient = useDeleteClient();

  const armed = confirmText.trim() === client.companyName.trim();

  async function handleDelete() {
    if (!armed || deleteClient.isPending) return;
    try {
      await deleteClient.mutateAsync(client.id);
      toast.success(`${client.companyName} removed`);
      navigate('/clients');
    } catch (err) {
      logError('Delete client failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to remove client');
    }
  }

  // Reset the typed confirmation whenever the dialog is toggled so a previous
  // attempt never leaves the button armed.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setConfirmText('');
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-red-600 hover:text-red-600 border-red-200 hover:bg-red-50"
      >
        <Trash2 className="size-4 mr-1.5" />
        Remove Client
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove client</DialogTitle>
            <DialogDescription>
              This permanently deletes <strong>{client.companyName}</strong> along with its
              contacts, documents, invoices, credit history, activity and portal logins. Campaigns
              are kept but unlinked. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-client-name">
              Type <span className="font-semibold">{client.companyName}</span> to confirm
            </Label>
            <Input
              id="confirm-client-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={client.companyName}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!armed || deleteClient.isPending}
              onClick={handleDelete}
            >
              {deleteClient.isPending ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="size-4 mr-1.5" />
              )}
              Remove Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
