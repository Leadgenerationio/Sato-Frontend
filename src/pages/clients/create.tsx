import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateClient, type ClientContactInput, type ContactType } from '@/lib/hooks/use-clients';
import { useLbBuyers } from '@/lib/hooks/use-leadbyte';

import { logError } from '../../lib/log';
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/clients"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="New Client" description="Add a new client to Stato" />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input value={form.companyName} onChange={(e) => update('companyName', e.target.value)} placeholder="Acme Ltd" />
                </div>
                <div className="space-y-2">
                  <Label>Company Number</Label>
                  <Input value={form.companyNumber} onChange={(e) => update('companyNumber', e.target.value)} placeholder="12345678" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address Line</Label>
                <Input value={form.addressLine} onChange={(e) => update('addressLine', e.target.value)} placeholder="10 Fleet Street" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Town / City</Label>
                  <Input value={form.addressTown} onChange={(e) => update('addressTown', e.target.value)} placeholder="London" />
                </div>
                <div className="space-y-2">
                  <Label>County</Label>
                  <Input value={form.addressCounty} onChange={(e) => update('addressCounty', e.target.value)} placeholder="Greater London" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={form.addressCountry} onChange={(e) => update('addressCountry', e.target.value)} placeholder="United Kingdom" />
                </div>
                <div className="space-y-2">
                  <Label>Postcode</Label>
                  <Input value={form.addressPostcode} onChange={(e) => update('addressPostcode', e.target.value)} placeholder="EC4Y 1AA" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
              <CardDescription>One primary contact required. Add billing or compliance contacts as needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeContact(idx)} aria-label="Remove contact">
                        <Trash2 className="size-4 text-negative" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Name {c.contactType === 'primary' && '*'}</Label>
                      <Input value={c.name} onChange={(e) => updateContact(idx, { name: e.target.value })} placeholder="Jamie Roberts" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role / Title</Label>
                      <Input value={c.role} onChange={(e) => updateContact(idx, { role: e.target.value })} placeholder="National Sales Director" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email {c.contactType === 'primary' && '*'}</Label>
                      <Input type="email" value={c.email} onChange={(e) => updateContact(idx, { email: e.target.value })} placeholder="jamie@uken.co.uk" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input value={c.phone} onChange={(e) => updateContact(idx, { phone: e.target.value })} placeholder="+44 20 1234 5678" />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Billing Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <select value={form.currency} onChange={(e) => update('currency', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <select value={form.paymentTermsDays} onChange={(e) => update('paymentTermsDays', Number(e.target.value))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                    <option value={4}>4 days (Mon issue → Fri due)</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Lead Price</Label>
                  <Input type="number" min={0} step={0.01} value={form.leadPrice} onChange={(e) => update('leadPrice', Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="vat-registered">VAT Registered</Label>
                  <input id="vat-registered" type="checkbox" checked={form.vatRegistered} onChange={(e) => { update('vatRegistered', e.target.checked); update('addVatToInvoices', e.target.checked); }} className="size-4 rounded border-input" />
                </div>
                <div className="space-y-2">
                  <Label>Billing Workflow</Label>
                  <select value={form.billingWorkflow} onChange={(e) => update('billingWorkflow', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                    <option value="weekly_auto">Weekly Auto</option>
                    <option value="monthly_validated">Monthly Validated</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              {form.vatRegistered && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>VAT Number</Label>
                    <Input value={form.vatNumber} onChange={(e) => update('vatNumber', e.target.value)} placeholder="GB123456789" />
                  </div>
                  <div className="space-y-2">
                    <Label>VAT Rate (%)</Label>
                    <Input type="number" min={0} max={100} step={0.01} value={form.vatRate} onChange={(e) => update('vatRate', Number(e.target.value))} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">External IDs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Optional — link this client to external systems. Leave blank if unknown; you can fill in later.</p>
              <div className="space-y-2">
                <Label>LeadByte Buyer</Label>
                <LeadByteBuyerSelect
                  value={form.leadbyteClientId}
                  onChange={(v) => update('leadbyteClientId', v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Companies House number</Label>
                <Input value={form.endoleCompanyId} onChange={(e) => update('endoleCompanyId', e.target.value)} placeholder="UK Companies House number used for credit checks" />
              </div>
              <div className="space-y-2">
                <Label>Xero Contact ID</Label>
                <Input value={form.xeroContactId} onChange={(e) => update('xeroContactId', e.target.value)} placeholder="Populated after Xero sync" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Any notes about this client..."
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <Button type="submit" disabled={createClient.isPending}>
            {createClient.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
            Create Client
          </Button>
          <div className="flex flex-col">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={sendAgreementAfter}
                onChange={(e) => setSendAgreementAfter(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Send agreement immediately after creation
            </label>
            {sendAgreementAfter && (
              // Sam #27: he hit "no agreement to send" because nothing was
              // uploaded yet. Make the prereq visible inline so staff know
              // what the dialog will need.
              <p className="text-xs text-muted-foreground mt-1.5 ml-6">
                You'll need an agreement PDF ready to upload, or this dialog will be empty.
              </p>
            )}
          </div>
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
    return <p className="text-xs text-muted-foreground">Loading buyers from LeadByte…</p>;
  }
  if (isError) {
    // Fallback to text input so a LeadByte outage doesn't block client creation.
    return (
      <>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. lb-1" />
        <p className="text-xs text-warning">LeadByte unreachable — entering buyer id manually.</p>
      </>
    );
  }
  if (options.length === 0) {
    return (
      <>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. lb-1" />
        <p className="text-xs text-muted-foreground">No active LeadByte buyers found — enter id manually.</p>
      </>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
    >
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
  );
}
