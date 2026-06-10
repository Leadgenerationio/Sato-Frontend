import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Plus, X, Loader2, Check, ChevronDown, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoiceClients, useCreateInvoice, type LineItem, type InvoiceClient } from '@/lib/hooks/use-invoices';

import { logError } from '../../lib/log';
// Local row type — adds a stable id so we can key by id rather than array index.
// The id is stripped before submission; only the LineItem-shaped fields are sent.
type EditableLine = LineItem & { id: string };

function makeLine(): EditableLine {
  return { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0, amount: 0 };
}

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
  const [lines, setLines] = useState<EditableLine[]>([makeLine()]);

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
    setLines((prev) => [...prev, makeLine()]);
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
      // Strip local id from line items — backend only knows about the LineItem shape.
      const lineItems: LineItem[] = lines.map(({ id: _id, ...rest }) => rest);
      const invoice = await createInvoice.mutateAsync({
        clientId: selectedClientId,
        currency,
        lineItems,
        addVat,
        dueDate: dueDate ? dueDate.toISOString() : undefined,
      });
      toast.success(`Invoice ${invoice.invoiceNumber} created`);
      navigate(`/finance/invoices/${invoice.id}`);
    } catch (err) {
      logError('Create invoice failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create invoice');
    }
  }

  if (clientsLoading) {
    return (
      <div className="screen-page">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="screen-page nc-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/finance/invoices" className="nc-back" title="Back to invoices">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="ahead-title">Create Invoice</h1>
            <p className="ahead-sub">Create a new invoice and push to Xero</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="ci-layout">
          <div className="card pad acard ci-lines">
            <h3 className="statto-title nc-h">Line Items</h3>
            <div className="ci-line-head">
              <span>Description</span><span>Qty</span><span>Unit Price</span><span className="r">Amount</span><span></span>
            </div>
            {lines.map((line, i) => (
              <div key={line.id} className="ci-line">
                <input
                  className="nc-input"
                  placeholder="Lead type…"
                  value={line.description}
                  onChange={(e) => updateLine(i, 'description', e.target.value)}
                />
                <input
                  className="nc-input r"
                  type="number"
                  min={1}
                  value={line.quantity === 0 ? '' : line.quantity}
                  onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
                <input
                  className="nc-input"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={line.unitPrice === 0 ? '' : line.unitPrice}
                  onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
                <span className="ci-amt mono">{formatCurrency(line.amount, currency)}</span>
                <button
                  type="button"
                  className="ci-line-x"
                  onClick={() => removeLine(i)}
                  disabled={lines.length === 1}
                  title="Remove line"
                >
                  <X className="size-[15px]" />
                </button>
              </div>
            ))}

            <button type="button" className="btn b-ghost b-sm ci-add" onClick={addLine}>
              <Plus className="size-[15px]" /> Add Line
            </button>

            <div className="ci-sep"></div>
            <div className="ci-total-row"><span>Subtotal</span><span className="mono">{formatCurrency(subtotal, currency)}</span></div>
            {addVat && <div className="ci-total-row"><span>VAT (20%)</span><span className="mono">{formatCurrency(vatAmount, currency)}</span></div>}
            <div className="ci-total-row grand"><span>Total</span><span className="mono">{formatCurrency(total, currency)}</span></div>
          </div>

          <div className="ci-side">
            <div className="card pad acard">
              <h3 className="statto-title nc-h">Invoice Settings</h3>

              <div className="nc-field">
                <label className="nc-label">Client</label>
                <div className="nc-select-wrap">
                  <select
                    className={'nc-select' + (selectedClientId ? '' : ' nc-muted')}
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                  >
                    <option value="">Select a client…</option>
                    {clients?.map((c: InvoiceClient) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span className="lic"><ChevronDown className="size-[15px]" /></span>
                </div>
              </div>

              <div className="nc-field">
                <label className="nc-label">Currency</label>
                <div className="nc-select-wrap">
                  <select className="nc-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                  <span className="lic"><ChevronDown className="size-[15px]" /></span>
                </div>
              </div>

              <div className="nc-field">
                <label className="nc-label">Due Date</label>
                <div className="ci-date">
                  <span className="lic"><Calendar className="size-4" /></span>
                  <DatePicker
                    date={dueDate}
                    onSelect={(d) => setDueDate(d)}
                    placeholder="Select due date"
                  />
                </div>
              </div>

              <label className="nc-check ci-vat">
                <input type="checkbox" checked={addVat} onChange={(e) => setAddVat(e.target.checked)} />
                <span className="nc-check-box"><Check className="size-[13px]" strokeWidth={3} /></span>
                <span>Add VAT (20%)</span>
              </label>

              {selectedClient && (
                <p className="nc-hint" style={{ marginTop: 12 }}>
                  {selectedClient.name} — {selectedClient.vatRegistered ? 'VAT registered' : 'Not VAT registered'}
                </p>
              )}
            </div>

            <button type="submit" className="btn b-dark b-block ci-submit" disabled={createInvoice.isPending}>
              {createInvoice.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Create Invoice
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
