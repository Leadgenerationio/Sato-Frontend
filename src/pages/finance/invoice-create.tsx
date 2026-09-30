import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Plus, X, Loader2, Check, ChevronDown, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useInvoiceClients, useCreateInvoice, type LineItem, type InvoiceClient } from '@/lib/hooks/use-invoices';
import { currencyLabel, currencyOptions } from '@/lib/currencies';
import { resolveVatTreatment, treatmentChargesVat, vatTreatmentLabel } from '@/lib/vat-treatment';

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

/** Local calendar date N days from today (the date picker works in local time). */
function addDays(days: number, from = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

const STATUS_LABEL: Record<string, string> = {
  onboarding: 'Onboarding',
  active: 'Active',
  paused: 'Paused',
};

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const { data: clients, isLoading: clientsLoading } = useInvoiceClients();
  const createInvoice = useCreateInvoice();

  const [selectedClientId, setSelectedClientId] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [addVat, setAddVat] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>(addDays(30));
  const [lines, setLines] = useState<EditableLine[]>([makeLine()]);
  const [confirmMismatch, setConfirmMismatch] = useState(false);

  const selectedClient = clients?.find((c: InvoiceClient) => c.id === selectedClientId);

  // M7 (Sam feedback 2026-09-29): the invoice follows the client record —
  // currency, due date (payment terms) and VAT treatment/rate — instead of
  // GBP / +30 days / 20% for everyone.
  const treatment = selectedClient ? resolveVatTreatment(selectedClient) : undefined;
  const vatAllowed = !selectedClient || treatmentChargesVat(treatment);
  const vatRate = selectedClient?.vatRate ?? 20;
  const termsDays = selectedClient?.paymentTermsDays ?? 30;
  const currencyMismatch = !!selectedClient && currency !== selectedClient.currency;

  function handleClientChange(clientId: string) {
    setSelectedClientId(clientId);
    setConfirmMismatch(false);
    const client = clients?.find((c: InvoiceClient) => c.id === clientId);
    if (client) {
      setCurrency(client.currency);
      setAddVat(treatmentChargesVat(resolveVatTreatment(client)));
      setDueDate(addDays(client.paymentTermsDays ?? 30));
    }
  }

  function handleCurrencyChange(next: string) {
    setCurrency(next);
    setConfirmMismatch(false);
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
  const vatMinor = addVat ? Math.round(subtotalMinor * (vatRate / 100)) : 0;
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
    if (currencyMismatch && !confirmMismatch) {
      toast.error(`Confirm you want to invoice ${selectedClient?.name} in ${currency} — they're billed in ${selectedClient?.currency}.`);
      return;
    }

    try {
      // Strip local id from line items — backend only knows about the LineItem shape.
      const lineItems: LineItem[] = lines.map(({ id: _id, ...rest }) => rest);
      const invoice = await createInvoice.mutateAsync({
        clientId: selectedClientId,
        currency,
        lineItems,
        addVat: addVat && vatAllowed,
        // Local calendar date — toISOString() shifted BST midnights back a day.
        dueDate: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
        ...(currencyMismatch ? { confirmCurrencyMismatch: confirmMismatch } : {}),
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
            <p className="ahead-sub">Create a new invoice. Push it to Xero from the invoice page</p>
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
            {addVat && <div className="ci-total-row"><span>VAT ({vatRate}%)</span><span className="mono">{formatCurrency(vatAmount, currency)}</span></div>}
            <div className="ci-total-row grand"><span>Total</span><span className="mono">{formatCurrency(total, currency)}</span></div>
          </div>

          <div className="ci-side">
            <div className="card pad acard">
              <h3 className="statto-title nc-h">Invoice Settings</h3>

              <div className="nc-field">
                <label className="nc-label" htmlFor="ci-client">Client</label>
                <div className="nc-select-wrap">
                  <select
                    id="ci-client"
                    className={'nc-select' + (selectedClientId ? '' : ' nc-muted')}
                    value={selectedClientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                  >
                    <option value="">Select a client…</option>
                    {clients?.map((c: InvoiceClient) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.status && c.status !== 'active' && STATUS_LABEL[c.status] ? ` (${STATUS_LABEL[c.status]})` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="lic"><ChevronDown className="size-[15px]" /></span>
                </div>
              </div>

              <div className="nc-field">
                <label className="nc-label" htmlFor="ci-currency">Currency</label>
                <div className="nc-select-wrap">
                  <select id="ci-currency" className="nc-select" value={currency} onChange={(e) => handleCurrencyChange(e.target.value)}>
                    {currencyOptions(currency).map((c) => (
                      <option key={c.code} value={c.code}>{currencyLabel(c.code)}</option>
                    ))}
                  </select>
                  <span className="lic"><ChevronDown className="size-[15px]" /></span>
                </div>
                {currencyMismatch && selectedClient && (
                  <div role="alert" className="nc-hint" style={{ color: '#8a5300', marginTop: 8, display: 'grid', gap: 8 }}>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <AlertTriangle className="size-4" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{selectedClient.name} is billed in {selectedClient.currency}. This invoice will be in {currency}.</span>
                    </span>
                    <label className="nc-check">
                      <input type="checkbox" checked={confirmMismatch} onChange={(e) => setConfirmMismatch(e.target.checked)} />
                      <span className="nc-check-box"><Check className="size-[13px]" strokeWidth={3} /></span>
                      <span>Yes, invoice in {currency}</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="nc-field">
                <label className="nc-label">Due Date</label>
                {selectedClient && <span className="nc-hint">{termsDays}-day payment terms</span>}
                <div className="ci-date">
                  <span className="lic"><Calendar className="size-4" /></span>
                  <DatePicker
                    date={dueDate}
                    onSelect={(d) => setDueDate(d)}
                    placeholder="Select due date"
                  />
                </div>
              </div>

              {vatAllowed ? (
                <label className="nc-check ci-vat">
                  <input type="checkbox" checked={addVat} onChange={(e) => setAddVat(e.target.checked)} />
                  <span className="nc-check-box"><Check className="size-[13px]" strokeWidth={3} /></span>
                  <span>Add VAT ({vatRate}%)</span>
                </label>
              ) : (
                <p className="nc-hint ci-vat">No VAT on this invoice — the client's VAT treatment is {vatTreatmentLabel(treatment)}.</p>
              )}

              {selectedClient && (
                <p className="nc-hint" style={{ marginTop: 12 }}>
                  {selectedClient.name} — {vatTreatmentLabel(treatment)} · billed in {selectedClient.currency}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn b-dark b-block ci-submit"
              disabled={createInvoice.isPending || (currencyMismatch && !confirmMismatch)}
            >
              {createInvoice.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Create Invoice
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
