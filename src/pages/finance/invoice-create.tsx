import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoiceClients, useCreateInvoice, type LineItem, type InvoiceClient } from '@/lib/hooks/use-invoices';

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

// Money math is done in integer minor units (e.g. pence) to avoid float drift
// across many line items. Inputs may be partial decimals; round once on entry.
function toMinor(value: number): number {
  return Math.round(value * 100);
}
function fromMinor(minor: number): number {
  return minor / 100;
}

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const { data: clients, isLoading: clientsLoading } = useInvoiceClients();
  const createInvoice = useCreateInvoice();

  const [selectedClientId, setSelectedClientId] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [addVat, setAddVat] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date(Date.now() + 30 * 86400000));
  const [lines, setLines] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);

  const selectedClient = clients?.find((c: InvoiceClient) => c.id === selectedClientId);

  function handleClientChange(clientId: string) {
    setSelectedClientId(clientId);
    const client = clients?.find((c: InvoiceClient) => c.id === clientId);
    if (client) {
      setCurrency(client.currency);
      setAddVat(client.vatRegistered);
    }
  }

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    setLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[index] };

      if (field === 'description') {
        line.description = value as string;
      } else if (field === 'quantity') {
        const n = Number(value);
        line.quantity = Number.isFinite(n) && n > 0 ? n : 0;
        line.amount = fromMinor(toMinor(line.quantity * line.unitPrice));
      } else if (field === 'unitPrice') {
        const n = Number(value);
        line.unitPrice = Number.isFinite(n) && n >= 0 ? n : 0;
        line.amount = fromMinor(toMinor(line.quantity * line.unitPrice));
      }

      updated[index] = line;
      return updated;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotalMinor = lines.reduce((sum, l) => sum + toMinor(l.amount), 0);
  const vatMinor = addVat ? Math.round(subtotalMinor * 0.2) : 0;
  const totalMinor = subtotalMinor + vatMinor;
  const subtotal = fromMinor(subtotalMinor);
  const vatAmount = fromMinor(vatMinor);
  const total = fromMinor(totalMinor);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId) {
      toast.error('Please select a client');
      return;
    }
    if (lines.some((l) => !l.description || l.amount <= 0)) {
      toast.error('Please fill in all line items');
      return;
    }

    try {
      const invoice = await createInvoice.mutateAsync({ clientId: selectedClientId, currency, lineItems: lines, addVat });
      toast.success(`Invoice ${invoice.invoiceNumber} created`);
      navigate(`/finance/invoices/${invoice.id}`);
    } catch (err) {
      console.error('Create invoice failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create invoice');
    }
  }

  if (clientsLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/finance/invoices">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
        </Link>
        <PageHeader title="Create Invoice" description="Create a new invoice and push to Xero" />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-12 sm:items-end sm:rounded-none sm:border-0 sm:p-0"
                >
                  <div className="sm:col-span-5">
                    <Label className="text-xs text-muted-foreground sm:hidden">Description</Label>
                    {i === 0 && <Label className="hidden text-xs text-muted-foreground sm:block">Description</Label>}
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(i, 'description', e.target.value)}
                      placeholder="Lead type..."
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:col-span-7 sm:grid-cols-7">
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-muted-foreground sm:hidden">Qty</Label>
                      {i === 0 && <Label className="hidden text-xs text-muted-foreground sm:block">Qty</Label>}
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity === 0 ? '' : line.quantity}
                        onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-muted-foreground sm:hidden">Unit Price</Label>
                      {i === 0 && <Label className="hidden text-xs text-muted-foreground sm:block">Unit Price</Label>}
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.unitPrice === 0 ? '' : line.unitPrice}
                        onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                    <div className="sm:col-span-2 sm:text-right">
                      <Label className="text-xs text-muted-foreground sm:hidden">Amount</Label>
                      {i === 0 && <Label className="hidden text-xs text-muted-foreground sm:block">Amount</Label>}
                      <p className="flex h-9 items-center text-sm font-medium tabular-nums sm:justify-end">
                        {formatCurrency(line.amount, currency)}
                      </p>
                    </div>
                    <div className="flex items-end justify-end sm:col-span-1">
                      {lines.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => removeLine(i)}>
                          <Trash2 className="size-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="size-4 mr-1.5" />
                Add Line
              </Button>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">{formatCurrency(subtotal, currency)}</span>
                </div>
                {addVat && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT (20%)</span>
                    <span className="font-medium tabular-nums">{formatCurrency(vatAmount, currency)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-base">
                  <span className="font-bold">Total</span>
                  <span className="font-bold tabular-nums">{formatCurrency(total, currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoice Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select a client...</option>
                    {clients?.map((c: InvoiceClient) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <DatePicker
                    date={dueDate}
                    onSelect={(d) => setDueDate(d)}
                    placeholder="Select due date"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Add VAT (20%)</Label>
                  <input
                    type="checkbox"
                    checked={addVat}
                    onChange={(e) => setAddVat(e.target.checked)}
                    className="size-4 rounded border-input"
                  />
                </div>

                {selectedClient && (
                  <p className="text-xs text-muted-foreground">
                    {selectedClient.name} — {selectedClient.vatRegistered ? 'VAT registered' : 'Not VAT registered'}
                  </p>
                )}
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={createInvoice.isPending}>
              {createInvoice.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Create Invoice
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
