import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Link2, Loader2, Save, Search, TriangleAlert, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { FilterSelect, type FilterOption } from '@/components/ui/filter-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdAccounts, useBulkLinkAdAccounts, type AdAccountRow, type BulkLinkResult } from '@/lib/hooks/use-ad-accounts';
import {
  accountKey, assignClient, buildLinkChanges, effectiveDraft, isChanged, spendByCurrency, type LinkDraft,
} from '@/lib/ad-account-drafts';

// Sam S13 (feedback round 1, 2026-09-29): "Only 3 of 14 active campaigns are
// linked to a client … Linking is one page at a time." One screen to say
// which client (and optionally which campaign) owns every ad account.
// Matching is on the account ID, never the name.

type LinkedFilter = 'unlinked' | 'linked' | 'all';
const NONE = '__none__';

function money(value: number, currency: string | null) {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency ?? 'GBP' }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency ?? ''}`.trim();
  }
}

function currencyList(parts: Array<{ currency: string; spend: number }>) {
  return parts.map((p) => money(p.spend, p.currency)).join(' + ');
}

export function AdAccountsPage() {
  const { data, isLoading, error } = useAdAccounts(30);
  const bulk = useBulkLinkAdAccounts();
  const [drafts, setDrafts] = useState<Map<string, LinkDraft>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [linkedFilter, setLinkedFilter] = useState<LinkedFilter>('unlinked');
  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState('');
  const [bulkClient, setBulkClient] = useState(NONE);
  const [lastSave, setLastSave] = useState<BulkLinkResult | null>(null);

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const clientOptions: FilterOption[] = useMemo(() => [
    { value: NONE, label: 'Not linked' },
    ...(data?.options.clients ?? []).map((c) => ({ value: c.id, label: c.companyName })),
  ], [data]);
  const campaignOptions: FilterOption[] = useMemo(() => [
    { value: NONE, label: 'Any campaign' },
    ...(data?.options.campaigns ?? []).map((c) => ({ value: c.id, label: c.name })),
  ], [data]);
  const platformOptions: FilterOption[] = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of accounts) seen.set(a.platform, a.platformLabel);
    return [{ value: 'all', label: 'All platforms' }, ...[...seen].map(([value, label]) => ({ value, label }))];
  }, [accounts]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      const linked = !!effectiveDraft(a, drafts).clientId;
      if (linkedFilter === 'unlinked' && linked && !isChanged(a, drafts)) return false;
      if (linkedFilter === 'linked' && !linked) return false;
      if (platform !== 'all' && a.platform !== platform) return false;
      if (q && !a.accountId.toLowerCase().includes(q) && !(a.accountName ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [accounts, drafts, linkedFilter, platform, search]);

  const changes = useMemo(() => buildLinkChanges(accounts, drafts), [accounts, drafts]);
  const unlinkedRows = accounts.filter((a) => !a.link);
  const unlinkedSpend = spendByCurrency(unlinkedRows);

  const setDraft = (a: AdAccountRow, next: Partial<LinkDraft>) => {
    setDrafts((prev) => {
      const cur = effectiveDraft(a, prev);
      const merged: LinkDraft = { ...cur, ...next };
      if (!merged.clientId) merged.campaignId = null;
      return new Map(prev).set(accountKey(a), merged);
    });
  };

  const toggle = (key: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const allVisibleSelected = visible.length > 0 && visible.every((a) => selected.has(accountKey(a)));
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) visible.forEach((a) => next.delete(accountKey(a)));
    else visible.forEach((a) => next.add(accountKey(a)));
    return next;
  });

  const applyBulk = () => {
    const rows = accounts.filter((a) => selected.has(accountKey(a)));
    setDrafts((prev) => assignClient(prev, rows, bulkClient === NONE ? null : bulkClient));
    setSelected(new Set());
  };

  const save = async () => {
    if (changes.length === 0 || bulk.isPending) return;
    try {
      const result = await bulk.mutateAsync(changes);
      setLastSave(result);
      setDrafts(new Map());
      const parts = [
        result.created && `${result.created} linked`,
        result.updated && `${result.updated} changed`,
        result.removed && `${result.removed} unlinked`,
      ].filter(Boolean);
      toast.success(parts.length ? `Saved: ${parts.join(', ')}` : 'Nothing needed saving');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the links — nothing was saved.");
    }
  };

  if (isLoading) {
    return (
      <div className="screen-page">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="screen-page">
        <div className="ph-screen">
          <span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span>
          <strong>Couldn't load ad accounts</strong>
          <p>{error instanceof Error ? error.message : 'Something went wrong reaching the server. Try refreshing the page.'}</p>
        </div>
      </div>
    );
  }

  const selectedCount = selected.size;

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Link ad accounts</h1>
          <p className="ahead-sub">Say which client owns each ad account, and optionally which campaign. Accounts are matched on their ID, never their name.</p>
        </div>
        <div className="page-actions">
          <Link to="/campaigns"><button className="btn b-ghost b-sm">Back to campaigns</button></Link>
        </div>
      </div>

      {unlinkedSpend.length > 0 ? (
        <div className="cmp-banner" data-testid="unlinked-banner">
          <span className="cmp-banner-ic"><TriangleAlert className="size-5" /></span>
          <div className="cmp-banner-text">
            <strong>{currencyList(unlinkedSpend)} of ad spend in the last {data.windowDays} days isn't linked to a client</strong>
            <span>
              {data.summary.unlinked} of {data.summary.total} ad accounts have no client. Pick a client for each (or select several and assign them together), then Save.
            </span>
          </div>
        </div>
      ) : (
        <div className="cmp-banner" data-testid="unlinked-banner">
          <span className="cmp-banner-ic"><CheckCircle2 className="size-5" /></span>
          <div className="cmp-banner-text">
            <strong>Every ad account with spend is linked to a client</strong>
            <span>{data.summary.linked} linked ad account{data.summary.linked === 1 ? '' : 's'}.</span>
          </div>
        </div>
      )}

      <div className="inv-toolbar">
        <div className="inv-tabs" role="tablist" aria-label="Link status">
          {(['unlinked', 'linked', 'all'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={linkedFilter === t}
              className={'inv-tab' + (linkedFilter === t ? ' on' : '')}
              onClick={() => setLinkedFilter(t)}
            >
              {t === 'unlinked' ? `Not linked (${data.summary.unlinked})` : t === 'linked' ? `Linked (${data.summary.linked})` : `All (${data.summary.total})`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterSelect value={platform} options={platformOptions} onChange={setPlatform} ariaLabel="Filter by platform" style={{ minWidth: 160 }} />
          <div className="inv-search">
            <Search className="size-4" />
            <input
              placeholder="Search account name or ID…"
              aria-label="Search account name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="card pad acard" data-testid="bulk-bar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{selectedCount} selected</strong>
          <span className="ac-sub" style={{ marginTop: 0 }}>Assign client:</span>
          <FilterSelect value={bulkClient} options={clientOptions} onChange={setBulkClient} ariaLabel="Client for selected ad accounts" style={{ minWidth: 220 }} />
          <button className="btn b-dark b-sm" onClick={applyBulk}>
            <Link2 className="size-[15px]" /> Apply to {selectedCount}
          </button>
          <button className="btn b-ghost b-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="card acard inv-card">
        {visible.length === 0 ? (
          <div className="ph-screen">
            <span className="ph-screen-ic"><CheckCircle2 className="size-[26px]" /></span>
            <strong>{accounts.length === 0 ? 'No ad accounts yet' : 'Nothing matches'}</strong>
            <p>
              {accounts.length === 0
                ? 'Ad accounts appear here once Catchr has synced spend, or once an account is added on a campaign page.'
                : linkedFilter === 'unlinked' ? 'Every ad account in this view is linked.' : 'Try a different filter or search.'}
            </p>
          </div>
        ) : (
          <>
          {/* Phone: one card per account so the client picker is on screen,
              not behind a sideways-scrolling table. */}
          <ul className="md:hidden" data-testid="ad-account-cards" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {visible.map((a) => {
              const key = accountKey(a);
              const draft = effectiveDraft(a, drafts);
              const changed = isChanged(a, drafts);
              return (
                <li
                  key={key}
                  data-changed={changed || undefined}
                  style={{ padding: 16, borderBottom: '1px solid var(--border)', background: changed ? 'var(--warning-bg)' : undefined, display: 'grid', gap: 10 }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <label className="tap-check"><input type="checkbox" aria-label={`Select ${a.accountName ?? a.accountId}`} checked={selected.has(key)} onChange={() => toggle(key)} /></label>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cl-contact">{a.accountName ?? <span className="cmp-client">No name in Catchr</span>}</div>
                      <div className="cl-email mono" style={{ overflowWrap: 'anywhere' }}>{a.platformLabel} · {a.accountId}</div>
                      {a.campaigns.length > 0 && <div className="cmp-client">On {a.campaigns.map((c) => c.campaignName).join(', ')}</div>}
                    </div>
                    <strong className="mono">{money(a.spend, a.currency)}</strong>
                  </div>
                  <RowPickers account={a} draft={draft} clientOptions={clientOptions} campaignOptions={campaignOptions} onChange={setDraft} />
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block">
          <div className="table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" aria-label="Select all shown ad accounts" checked={allVisibleSelected} onChange={toggleAllVisible} />
                  </th>
                  <th>Platform</th>
                  <th>Ad account</th>
                  <th className="r">Spend ({data.windowDays}d)</th>
                  <th style={{ maxWidth: 160 }}>Used on campaign</th>
                  <th>Client</th>
                  <th>Campaign (optional)</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const key = accountKey(a);
                  const draft = effectiveDraft(a, drafts);
                  const changed = isChanged(a, drafts);
                  return (
                    <tr key={key} data-testid="ad-account-row" data-changed={changed || undefined} style={changed ? { background: 'var(--warning-bg)' } : undefined}>
                      <td>
                        <label className="tap-check"><input type="checkbox" aria-label={`Select ${a.accountName ?? a.accountId}`} checked={selected.has(key)} onChange={() => toggle(key)} /></label>
                      </td>
                      <td><span className="cmp-vpill">{a.platformLabel}</span></td>
                      <td>
                        <div className="cl-contact">{a.accountName ?? <span className="cmp-client">No name in Catchr</span>}</div>
                        <div className="cl-email mono">{a.accountId}</div>
                      </td>
                      <td className="r mono inv-total">{money(a.spend, a.currency)}</td>
                      <td className="cmp-client" style={{ maxWidth: 160 }}>
                        {a.campaigns.length === 0 ? '—' : a.campaigns.map((c) => c.campaignName).join(', ')}
                      </td>
                      <RowPickers account={a} draft={draft} clientOptions={clientOptions} campaignOptions={campaignOptions} onChange={setDraft} asCells />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
          </>
        )}
      </div>

      {lastSave && lastSave.results.some((r) => r.action !== 'unchanged') && (
        <div className="card pad acard" data-testid="save-summary">
          <h3 className="statto-title">Last save</h3>
          <ul className="ac-sub" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {lastSave.results.filter((r) => r.action !== 'unchanged').map((r) => (
              <li key={`${r.platform}|${r.accountId}`}>
                <span className="mono">{r.accountId}</span>{' — '}
                {r.action === 'removed'
                  ? 'unlinked'
                  : `${r.action === 'created' ? 'linked to' : 'now linked to'} ${r.clientName}${r.campaignName ? ` · ${r.campaignName}` : ''}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {changes.length > 0 && (
        <div
          className="card pad acard"
          data-testid="save-bar"
          // Buttons sit on the left, clear of the SOS button in the
          // bottom-right corner (Sam S15: "SOS button covers content").
          style={{ position: 'sticky', bottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', zIndex: 5 }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn b-dark b-sm" onClick={save} disabled={bulk.isPending}>
              {bulk.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <Save className="size-[15px]" />} Save {changes.length} change{changes.length === 1 ? '' : 's'}
            </button>
            <button className="btn b-ghost b-sm" onClick={() => setDrafts(new Map())} disabled={bulk.isPending}>
              <Undo2 className="size-[15px]" /> Discard
            </button>
          </div>
          <span><strong>{changes.length}</strong> unsaved change{changes.length === 1 ? '' : 's'}</span>
        </div>
      )}
    </div>
  );
}

function RowPickers({ account: a, draft, clientOptions, campaignOptions, onChange, asCells }: {
  account: AdAccountRow;
  draft: LinkDraft;
  clientOptions: FilterOption[];
  campaignOptions: FilterOption[];
  onChange: (a: AdAccountRow, next: Partial<LinkDraft>) => void;
  asCells?: boolean;
}) {
  const client = (
    <FilterSelect
      value={draft.clientId ?? NONE}
      options={clientOptions}
      muted={!draft.clientId}
      onChange={(v) => onChange(a, { clientId: v === NONE ? null : v })}
      ariaLabel={`Client for ${a.accountName ?? a.accountId}`}
    />
  );
  const campaign = (
    <FilterSelect
      value={draft.campaignId ?? NONE}
      options={campaignOptions}
      muted={!draft.campaignId}
      disabled={!draft.clientId}
      onChange={(v) => onChange(a, { campaignId: v === NONE ? null : v })}
      ariaLabel={`Campaign for ${a.accountName ?? a.accountId}`}
    />
  );
  if (asCells) {
    return (
      <>
        <td style={{ minWidth: 170 }}>{client}</td>
        <td style={{ minWidth: 170 }}>{campaign}</td>
      </>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {client}
      {campaign}
    </div>
  );
}
