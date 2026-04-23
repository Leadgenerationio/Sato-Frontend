import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateClient } from '@/lib/hooks/use-clients';

export function ClientCreatePage() {
  const navigate = useNavigate();
  const createClient = useCreateClient();

  const [form, setForm] = useState({
    companyName: '',
    companyNumber: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    currency: 'GBP',
    paymentTermsDays: 30,
    vatRegistered: false,
    addVatToInvoices: false,
    leadPrice: 0,
    billingWorkflow: 'weekly_auto',
    leadbyteClientId: '',
    endoleCompanyId: '',
    xeroContactId: '',
    notes: '',
  });

  function update(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName || !form.contactName || !form.contactEmail) {
      toast.error('Please fill in company name, contact name, and email');
      return;
    }
    try {
      const client = await createClient.mutateAsync(form);
      toast.success(`${client.companyName} created`);
      navigate(`/clients/${client.id}`);
    } catch {
      toast.error('Failed to create client');
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
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="10 Fleet Street, London" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Contact Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contact Name *</Label>
                <Input value={form.contactName} onChange={(e) => update('contactName', e.target.value)} placeholder="John Smith" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} placeholder="john@acme.co.uk" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} placeholder="+44 20 1234 5678" />
                </div>
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
                  <Label>VAT Registered</Label>
                  <input type="checkbox" checked={form.vatRegistered} onChange={(e) => { update('vatRegistered', e.target.checked); update('addVatToInvoices', e.target.checked); }} className="size-4 rounded border-input" />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">External IDs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Optional — link this client to external systems. Leave blank if unknown; you can fill in later.</p>
              <div className="space-y-2">
                <Label>LeadByte Client ID</Label>
                <Input value={form.leadbyteClientId} onChange={(e) => update('leadbyteClientId', e.target.value)} placeholder="e.g. lb-1" />
              </div>
              <div className="space-y-2">
                <Label>Endole Company ID</Label>
                <Input value={form.endoleCompanyId} onChange={(e) => update('endoleCompanyId', e.target.value)} placeholder="Populated after first credit check" />
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

        <div className="mt-6">
          <Button type="submit" disabled={createClient.isPending}>
            {createClient.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
            Create Client
          </Button>
        </div>
      </form>
    </div>
  );
}
