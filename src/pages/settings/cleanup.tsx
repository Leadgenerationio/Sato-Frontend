import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, FileSignature, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useCleanupReport, useApplyCleanup, summariseCleanup,
  type CleanupApplyInput, type CleanupApplyResult, type CleanupReport, type DemoteRole,
} from '@/lib/hooks/use-cleanup';

// Settings → Clean up (Sam feedback round 1, 29 Sep 2026: S8 + N6).
// Owner only. One screen to resolve demo/test logins, extra Owners and test
// data. Nothing is deleted: logins are deactivated, Owners get a lower role,
// SOS / SOP / staff rows are archived (hidden from lists), names are trimmed.

type Tab = 'logins' | 'owners' | 'data';

const DEMOTE_OPTIONS: { value: DemoteRole; label: string }[] = [
  { value: 'ops_manager', label: 'Ops Manager' },
  { value: 'finance_admin', label: 'Finance Admin' },
  { value: 'readonly', label: 'Readonly' },
];

function Tick({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="nc-check cu-tick">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="nc-check-box"><Check className="size-[13px]" strokeWidth={3} /></span>
    </label>
  );
}

function initialSelection(r: CleanupReport) {
  const pick = (rows: { id: string; preselect: boolean }[]) => new Set(rows.filter((x) => x.preselect).map((x) => x.id));
  return {
    logins: pick(r.testLogins.filter((u) => !u.isYou && !u.isPrimaryOwner)),
    sos: pick(r.testSos),
    sops: pick(r.testSops),
    staff: pick(r.placeholderStaff),
    trim: r.untrimmedContacts.length > 0,
    demote: {} as Record<string, DemoteRole | ''>,
  };
}

export function CleanupPage() {
  const { data: report, isLoading, error, refetch } = useCleanupReport();
  const apply = useApplyCleanup();
  const [tab, setTab] = useState<Tab>('logins');
  const [sel, setSel] = useState<ReturnType<typeof initialSelection> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<CleanupApplyResult | null>(null);

  // Reset the selection whenever a fresh report arrives (first load, after Apply).
  useEffect(() => { if (report) setSel(initialSelection(report)); }, [report]);

  const input: CleanupApplyInput | null = useMemo(() => {
    if (!sel || !report) return null;
    return {
      deactivateUserIds: [...sel.logins],
      demoteOwnerIds: Object.entries(sel.demote).filter(([, r]) => !!r).map(([id, role]) => ({ id, role: role as DemoteRole })),
      archiveSosIds: [...sel.sos],
      archiveSopIds: [...sel.sops],
      archiveStaffIds: [...sel.staff],
      trimContacts: sel.trim && report.untrimmedContacts.length > 0,
    };
  }, [sel, report]);
  const summary = input && report ? summariseCleanup(input, report) : [];

  const toggle = (key: 'logins' | 'sos' | 'sops' | 'staff', id: string, on: boolean) =>
    setSel((s) => {
      if (!s) return s;
      const next = new Set(s[key]);
      if (on) next.add(id); else next.delete(id);
      return { ...s, [key]: next };
    });

  async function runApply() {
    if (!input) return;
    setConfirmOpen(false);
    try {
      const res = await apply.mutateAsync(input);
      setResult(res);
      toast.success('Clean-up applied', { description: 'Nothing was deleted — see what changed below.' });
    } catch (err) {
      toast.error("Couldn't apply the clean-up", { description: err instanceof Error ? err.message : 'Nothing was changed. Try again.' });
      refetch();
    }
  }

  if (isLoading || (!sel && !error)) {
    return <div className="screen-page"><p className="ac-sub" style={{ padding: 32 }}>Checking for test data…</p></div>;
  }
  if (error || !report || !sel) {
    return (
      <div className="screen-page">
        <div className="ph-screen">
          <span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span>
          <strong>Couldn't load the clean-up list</strong>
          <p>{error instanceof Error ? error.message : 'Try refreshing the page.'}</p>
        </div>
      </div>
    );
  }

  const counts = {
    logins: report.testLogins.length,
    owners: report.owners.length,
    data: report.testSos.length + report.testSops.length + report.placeholderStaff.length + report.untrimmedContacts.length,
  };
  const nothingFound = counts.logins + counts.data === 0 && report.owners.length <= 1;

  return (
    <div className="screen-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/settings" aria-label="Back to settings"><button className="nc-back" title="Back to settings" aria-label="Back to settings"><ArrowLeft className="size-5" /></button></Link>
          <div>
            <h1 className="ahead-title">Clean up test data</h1>
            <p className="ahead-sub">Demo and test logins, extra Owners and test entries. Nothing is deleted.</p>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn b-dark b-sm" disabled={summary.length === 0 || apply.isPending} onClick={() => setConfirmOpen(true)}>
            {apply.isPending ? <Loader2 className="size-[15px] animate-spin" aria-hidden /> : <Sparkles className="size-[15px]" aria-hidden />}
            Apply{summary.length ? ` (${summary.length})` : ''}
          </button>
        </div>
      </div>

      {report.agreementTemplatesCount === 0 && (
        <div className="cmp-banner" role="status">
          <span className="cmp-banner-ic"><FileSignature className="size-5" aria-hidden /></span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <strong>No agreement templates yet</strong>
            <p className="ac-sub" style={{ marginTop: 2 }}>"Send agreement" has nothing to pick until you add one.</p>
          </div>
          <Link to="/agreements/templates" className="btn b-ghost b-sm">Add a template</Link>
        </div>
      )}

      {result && (
        <div className="card pad acard cu-result" role="status">
          <h3 className="statto-title"><CheckCircle2 className="size-4" aria-hidden style={{ color: 'var(--positive)' }} /> What changed</h3>
          <ul>
            {result.deactivated.map((u) => <li key={'d' + u.id}>Deactivated <strong>{u.email}</strong></li>)}
            {result.demoted.map((u) => <li key={'r' + u.id}><strong>{u.email}</strong> is now {DEMOTE_OPTIONS.find((o) => o.value === u.role)?.label}</li>)}
            {result.archivedSos > 0 && <li>Archived {result.archivedSos} SOS {result.archivedSos === 1 ? 'entry' : 'entries'}</li>}
            {result.archivedSops > 0 && <li>Archived {result.archivedSops} SOP{result.archivedSops === 1 ? '' : 's'}</li>}
            {result.archivedStaff > 0 && <li>Archived {result.archivedStaff} staff record{result.archivedStaff === 1 ? '' : 's'}</li>}
            {result.trimmedContacts + result.trimmedClients > 0 && <li>Removed extra spaces from {result.trimmedContacts + result.trimmedClients} name{result.trimmedContacts + result.trimmedClients === 1 ? '' : 's'}</li>}
          </ul>
        </div>
      )}

      {nothingFound ? (
        <div className="ph-screen">
          <span className="ph-screen-ic"><CheckCircle2 className="size-[26px]" /></span>
          <strong>Nothing to clean up</strong>
          <p>No test logins, test entries or untidy names were found.</p>
        </div>
      ) : (
        <>
          <div className="inv-toolbar">
            <div className="inv-tabs" role="tablist" aria-label="Clean-up sections">
              {([['logins', 'Test logins'], ['owners', 'Owners'], ['data', 'Test data']] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={'inv-tab' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
                  {label} <span className="cu-count">{counts[id]}</span>
                </button>
              ))}
            </div>
          </div>

          {tab === 'logins' && (
            <section className="card pad acard" aria-labelledby="cu-logins-h">
              <h3 id="cu-logins-h" className="statto-title">Demo and test logins</h3>
              <p className="ac-sub cu-sub">Ticked logins are <strong>deactivated</strong>: they can't sign in, and their history stays.</p>
              {report.testLogins.length === 0 ? <p className="ac-sub">None found.</p> : (
                <ul className="cu-list">
                  {report.testLogins.map((u) => {
                    const locked = u.isYou || u.isPrimaryOwner;
                    return (
                      <li key={u.id} className="cu-row">
                        <Tick checked={sel.logins.has(u.id)} disabled={locked} onChange={(v) => toggle('logins', u.id, v)} label={`Deactivate ${u.email}`} />
                        <div className="cu-main">
                          <div className="cu-title">{u.email} <span className="pill p-gray" style={{ textTransform: 'capitalize' }}>{u.role.replace('_', ' ')}</span></div>
                          <div className="cu-reason">{locked ? (u.isYou ? "This is you — can't be changed here" : 'Primary Owner — protected') : u.reason}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {tab === 'owners' && (
            <section className="card pad acard" aria-labelledby="cu-owners-h">
              <h3 id="cu-owners-h" className="statto-title">Who has Owner access</h3>
              <p className="ac-sub cu-sub">Owners can see and change everything. To limit someone (e.g. the agency), pick a lower role, or give them an end date on the Users page.</p>
              <ul className="cu-list">
                {report.owners.map((u) => {
                  const locked = u.isYou || u.isPrimaryOwner;
                  return (
                    <li key={u.id} className="cu-row">
                      <div className="cu-main">
                        <div className="cu-title">{u.name} <span className="cu-email">{u.email}</span>
                          {u.isYou && <span className="pill p-gray">You</span>}
                          {u.isPrimaryOwner && <span className="pill p-gray">Primary</span>}
                        </div>
                        <div className="cu-reason">{u.reason}</div>
                      </div>
                      {locked ? <span className="cu-reason">Stays Owner</span> : (
                        <div className="nc-select-wrap cu-role">
                          <select
                            className="nc-select"
                            aria-label={`New role for ${u.email}`}
                            value={sel.demote[u.id] ?? ''}
                            disabled={sel.logins.has(u.id)}
                            onChange={(e) => setSel((s) => (s ? { ...s, demote: { ...s.demote, [u.id]: e.target.value as DemoteRole | '' } } : s))}
                          >
                            <option value="">Keep as Owner</option>
                            {DEMOTE_OPTIONS.map((o) => <option key={o.value} value={o.value}>Change to {o.label}</option>)}
                          </select>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {tab === 'data' && (
            <section className="card pad acard" aria-labelledby="cu-data-h">
              <h3 id="cu-data-h" className="statto-title">Test entries</h3>
              <p className="ac-sub cu-sub">Ticked entries are <strong>archived</strong>: hidden from lists, never deleted.</p>
              {([
                ['sos', 'SOS queue', report.testSos],
                ['sops', 'SOPs', report.testSops],
                ['staff', 'Staff', report.placeholderStaff],
              ] as const).map(([key, heading, rows]) => rows.length > 0 && (
                <div key={key} className="cu-group">
                  <h4 className="cu-group-h">{heading}</h4>
                  <ul className="cu-list">
                    {rows.map((r) => (
                      <li key={r.id} className="cu-row">
                        <Tick checked={sel[key].has(r.id)} onChange={(v) => toggle(key, r.id, v)} label={`Archive ${heading} "${r.label}"`} />
                        <div className="cu-main">
                          <div className="cu-title">{r.label}{r.detail && <span className="cu-email">{r.detail}</span>}</div>
                          <div className="cu-reason">{r.reason}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {report.untrimmedContacts.length > 0 && (
                <div className="cu-group">
                  <h4 className="cu-group-h">Names with extra spaces</h4>
                  <div className="cu-row">
                    <Tick checked={sel.trim} onChange={(v) => setSel((s) => (s ? { ...s, trim: v } : s))} label="Remove extra spaces from these names" />
                    <div className="cu-main">
                      <div className="cu-title">Remove extra spaces from {report.untrimmedContacts.length} name{report.untrimmedContacts.length === 1 ? '' : 's'}</div>
                      <div className="cu-reason">{report.untrimmedContacts.slice(0, 6).map((c) => c.label).join(', ')}{report.untrimmedContacts.length > 6 ? '…' : ''}</div>
                    </div>
                  </div>
                </div>
              )}
              {counts.data === 0 && <p className="ac-sub">None found.</p>}
            </section>
          )}
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply clean-up?</DialogTitle>
            <DialogDescription>This is exactly what will happen. Nothing is deleted.</DialogDescription>
          </DialogHeader>
          <ul className="cu-confirm">
            {summary.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <DialogFooter>
            <button className="btn b-ghost b-sm" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="btn b-dark b-sm" onClick={runApply}>Apply {summary.length} change{summary.length === 1 ? '' : 's'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
