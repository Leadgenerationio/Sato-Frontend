import { useEffect, useMemo, useState } from 'react';
import './xero-tax-codes.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { api, unwrap } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// Sam feedback 2026-09-29 (S4): the Xero tax type for each VAT treatment is
// an Owner setting. Reverse charge used to go to Xero as NONE, hard-coded
// "until the accountant confirms".

export type VatTreatmentKey = 'uk_standard' | 'uk_zero_rated' | 'reverse_charge' | 'outside_scope';
type TaxTypes = Record<VatTreatmentKey, string>;

interface TaxTypesResponse { taxTypes: TaxTypes; defaults: TaxTypes; known: string[] }

export const TREATMENT_ROWS: { key: VatTreatmentKey; label: string; hint: string }[] = [
  { key: 'uk_standard', label: 'UK VAT (standard rate)', hint: 'Invoices with a VAT line — typically OUTPUT2 (20% on income).' },
  { key: 'uk_zero_rated', label: 'UK VAT (zero-rated)', hint: 'Typically ZERORATEDOUTPUT.' },
  { key: 'reverse_charge', label: 'Reverse charge (EU / international B2B)', hint: 'Typically ECZROUTPUTSERVICES for services — confirm with your accountant.' },
  { key: 'outside_scope', label: 'No VAT (outside scope)', hint: 'Typically NONE, or EXEMPTOUTPUT if your accountant prefers.' },
];

const CUSTOM = '__custom__';
const CODE = /^[A-Z0-9]{2,20}$/;

/** Owner-only — gates itself so callers don't need their own role check. */
export function XeroTaxCodes() {
  const { user } = useAuth();
  if (user?.role !== 'owner') return null;
  return <XeroTaxCodesPanel />;
}

function XeroTaxCodesPanel() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings', 'xero-tax-types'],
    queryFn: async () => unwrap(await api.get<TaxTypesResponse>('/api/v1/settings/xero-tax-types')),
  });
  const [draft, setDraft] = useState<TaxTypes | null>(null);
  const [customOpen, setCustomOpen] = useState<Partial<Record<VatTreatmentKey, boolean>>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { if (data && !draft) setDraft(data.taxTypes); }, [data, draft]);

  const changes = useMemo(
    () => (data && draft ? TREATMENT_ROWS.filter((r) => draft[r.key] !== data.taxTypes[r.key]) : []),
    [data, draft],
  );
  const invalid = draft ? TREATMENT_ROWS.filter((r) => !CODE.test(draft[r.key])) : [];

  const save = useMutation({
    mutationFn: async (taxTypes: Partial<TaxTypes>) =>
      unwrap(await api.put<{ taxTypes: TaxTypes }>('/api/v1/settings/xero-tax-types', { taxTypes })).taxTypes,
    onSuccess: (taxTypes) => {
      qc.setQueryData(['settings', 'xero-tax-types'], (old: TaxTypesResponse | undefined) => (old ? { ...old, taxTypes } : old));
      setDraft(taxTypes);
      setConfirmOpen(false);
      toast.success('Xero tax codes saved. New pushes to Xero use them.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save the tax codes. Nothing was changed."),
  });

  if (isLoading) return <p className="set-intg-note">Loading VAT tax codes…</p>;
  if (isError || !data || !draft) return <p className="set-intg-note">Couldn't load the VAT tax codes. Refresh to try again.</p>;

  const options = Array.from(new Set([...data.known, ...Object.values(data.taxTypes)]));

  return (
    <section className="xtc" aria-labelledby="xtc-title">
      <div className="xtc-head">
        <ReceiptText className="size-4" aria-hidden />
        <h4 id="xtc-title">VAT tax codes sent to Xero</h4>
      </div>
      <p className="set-intg-note" style={{ marginTop: 0 }}>
        The Xero tax type each invoice line gets, by the client's VAT treatment. Check the codes with your accountant.
      </p>
      <div className="xtc-rows">
        {TREATMENT_ROWS.map((r) => {
          const value = draft[r.key];
          const isCustom = customOpen[r.key] || !options.includes(value);
          return (
            <div key={r.key} className="xtc-row">
              <label htmlFor={`xtc-${r.key}`} className="xtc-label">{r.label}</label>
              <div className="xtc-inputs">
                <select
                  id={`xtc-${r.key}`}
                  className="nc-select xtc-select"
                  value={isCustom ? CUSTOM : value}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM) { setCustomOpen((c) => ({ ...c, [r.key]: true })); return; }
                    setCustomOpen((c) => ({ ...c, [r.key]: false }));
                    setDraft({ ...draft, [r.key]: e.target.value });
                  }}
                >
                  {options.map((o) => <option key={o} value={o}>{o}{o === data.defaults[r.key] ? ' (default)' : ''}</option>)}
                  <option value={CUSTOM}>Other code…</option>
                </select>
                {isCustom && (
                  <input
                    className="nc-input xtc-custom"
                    aria-label={`${r.label} — custom Xero tax type`}
                    value={value}
                    onChange={(e) => setDraft({ ...draft, [r.key]: e.target.value.toUpperCase().replace(/\s/g, '') })}
                    placeholder="e.g. ECZROUTPUTSERVICES"
                  />
                )}
              </div>
              <p className="xtc-hint">{r.hint}</p>
              {!CODE.test(value) && <p className="xtc-err" role="alert">Use 2–20 capital letters or digits, e.g. OUTPUT2.</p>}
            </div>
          );
        })}
      </div>
      <div className="xtc-actions">
        <button
          type="button"
          className="btn b-dark b-sm"
          disabled={changes.length === 0 || invalid.length > 0 || save.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Save tax codes
        </button>
        {changes.length > 0 && (
          <button type="button" className="btn b-ghost b-sm" onClick={() => { setDraft(data.taxTypes); setCustomOpen({}); }}>Discard</button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change the Xero tax codes?</DialogTitle>
            <DialogDescription>Invoices already in Xero keep their codes. Invoices pushed from now on use:</DialogDescription>
          </DialogHeader>
          <ul className="xtc-summary">
            {changes.map((r) => (
              <li key={r.key}><strong>{r.label}</strong>: {data.taxTypes[r.key]} → {draft[r.key]}</li>
            ))}
          </ul>
          <DialogFooter>
            <button type="button" className="btn b-ghost b-sm" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn b-dark b-sm"
              disabled={save.isPending}
              onClick={() => save.mutate(Object.fromEntries(changes.map((r) => [r.key, draft[r.key]])))}
            >
              {save.isPending ? <><Loader2 className="size-[15px] animate-spin" /> Saving…</> : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
