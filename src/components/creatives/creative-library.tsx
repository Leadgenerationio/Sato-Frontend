import { useMemo, useState } from 'react';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Download, ExternalLink, FileVideo, ImageIcon, LayoutGrid,
  List, Loader2, Play, Search, Send, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { FilterSelect, type FilterOption } from '@/components/ui/filter-select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useClients } from '@/lib/hooks/use-clients';
import { useCampaigns } from '@/lib/hooks/use-campaigns';
import {
  useBulkCreatives, useLandingPages, useLibraryCreative, useLibraryCreatives, useUpdateLibraryCreative,
  type CreativeFilters, type LibraryCreative,
} from '@/lib/hooks/use-creative-library';
import { formatBytes, formatDuration } from '@/lib/creative-files';
import { CreativeUploader } from './creative-uploader';
import '@/creative-library.css';

// Creative library (Sam feedback round 1, M2 — plan phase 1). Used on its own
// page (/creatives, every client) and as the "Creatives" tab on a client
// (clientId fixed). Thumbnails and video previews, filters, search, sort,
// bulk actions, and a detail panel with the platform ad + landing page.

const ALL = 'all';
const NONE = '__none__';
const PAGE_SIZE = 24;

export const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta', taboola: 'Taboola', google: 'Google', tiktok: 'TikTok', manual: 'Uploaded',
};
export const STATUS_LABELS: Record<string, { label: string; pill: string }> = {
  draft: { label: 'Draft', pill: 'gray' },
  sent_for_approval: { label: 'Awaiting approval', pill: 'infosoft' },
  approved: { label: 'Approved', pill: 'pos' },
  rejected: { label: 'Rejected', pill: 'neg' },
  changes_requested: { label: 'Changes requested', pill: 'warn' },
};
const SORTS: FilterOption[] = [
  { value: 'created:desc', label: 'Newest first' },
  { value: 'created:asc', label: 'Oldest first' },
  { value: 'last_seen:desc', label: 'Last seen live' },
  { value: 'name:asc', label: 'Name A–Z' },
];

type View = 'grid' | 'table';
const VIEW_KEY = 'stato.creatives.view';
function readView(): View {
  try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'grid'; } catch { return 'grid'; }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dims(c: LibraryCreative) {
  const size = c.width && c.height ? `${c.width}×${c.height}` : null;
  const len = formatDuration(c.durationS);
  return [size, len].filter(Boolean).join(' · ') || null;
}

export interface CreativeLibraryProps {
  /** Fix the library to one client (client-detail tab). */
  clientId?: string;
}

export function CreativeLibrary({ clientId }: CreativeLibraryProps) {
  const [q, setQ] = useState('');
  const [client, setClient] = useState(ALL);
  const [platform, setPlatform] = useState(ALL);
  const [campaign, setCampaign] = useState(ALL);
  const [landingPage, setLandingPage] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('created:desc');
  const [page, setPage] = useState(1);
  const [view, setViewState] = useState<View>(readView);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'assign_landing_page' | 'move_client' | 'submit_for_approval'>('assign_landing_page');
  const [bulkTarget, setBulkTarget] = useState(NONE);

  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* per-viewer convenience only */ } };
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); setSelected(new Set()); };

  const [sortKey, order] = sort.split(':') as [CreativeFilters['sort'], CreativeFilters['order']];
  const filters: CreativeFilters = {
    clientId: clientId ?? (client === ALL ? undefined : client),
    platform, campaignId: campaign, landingPageId: landingPage, status,
    q: q.trim() || undefined, from: from || undefined, to: to || undefined,
    sort: sortKey, order, page, limit: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, error } = useLibraryCreatives(filters);
  const { data: clientsData } = useClients({ limit: 100 });
  const { data: campaignsData } = useCampaigns({ limit: 100 });
  const { data: landingPages } = useLandingPages({ clientId });
  const bulk = useBulkCreatives();

  const clientOptions: FilterOption[] = useMemo(
    () => (clientsData?.clients ?? []).map((c) => ({ value: c.id, label: c.companyName })), [clientsData]);
  const campaignOptions: FilterOption[] = useMemo(
    () => (campaignsData?.campaigns ?? []).map((c) => ({ value: c.id, label: c.name })), [campaignsData]);
  const lpOptions: FilterOption[] = useMemo(
    () => (landingPages ?? []).map((l) => ({ value: l.id, label: l.title ? `${l.title} — ${l.normalisedUrl}` : l.normalisedUrl })), [landingPages]);

  const creatives = data?.creatives ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / (data?.pageSize ?? PAGE_SIZE)));
  const filtered = !!(q || client !== ALL || platform !== ALL || campaign !== ALL || landingPage !== ALL || status !== ALL || from || to);

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOnPage = creatives.length > 0 && creatives.every((c) => selected.has(c.id));
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allOnPage) creatives.forEach((c) => n.delete(c.id)); else creatives.forEach((c) => n.add(c.id));
    return n;
  });

  const bulkNeedsTarget = bulkAction !== 'submit_for_approval';
  async function applyBulk() {
    const ids = [...selected];
    if (!ids.length || (bulkNeedsTarget && bulkTarget === NONE)) return;
    try {
      const body = bulkAction === 'assign_landing_page' ? { action: bulkAction, landingPageId: bulkTarget } as const
        : bulkAction === 'move_client' ? { action: bulkAction, clientId: bulkTarget } as const
        : { action: bulkAction } as const;
      const res = await bulk.mutateAsync({ ids, ...body });
      toast.success(`Updated ${res?.updated ?? ids.length} creative${(res?.updated ?? ids.length) === 1 ? '' : 's'}.`);
      setSelected(new Set());
      setBulkTarget(NONE);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : "Couldn't update the creatives."} Nothing was changed.`);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="inv-toolbar">
        <div className="inv-search" style={{ flex: 1, minWidth: 200 }}>
          <Search className="size-4" />
          <input placeholder="Search name, headline, ad ID…" aria-label="Search creatives" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} />
        </div>
        <div className="crl-toolbar">
          <FilterSelect value={sort} options={SORTS} onChange={resetPage(setSort)} ariaLabel="Sort creatives" style={{ minWidth: 160 }} />
          <div className="crl-view" role="group" aria-label="View">
            <button type="button" aria-label="Thumbnail grid" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid className="size-4" /></button>
            <button type="button" aria-label="Table" aria-pressed={view === 'table'} onClick={() => setView('table')}><List className="size-4" /></button>
          </div>
          <button type="button" className="btn b-dark b-sm" onClick={() => setUploadOpen(true)}><Upload className="size-[15px]" /> Upload creatives</button>
        </div>
      </div>

      <div className="crl-filters" data-testid="creative-filters">
        {!clientId && <FilterSelect value={client} options={[{ value: ALL, label: 'All clients' }, ...clientOptions]} onChange={resetPage(setClient)} ariaLabel="Filter by client" />}
        <FilterSelect value={platform} options={[{ value: ALL, label: 'All platforms' }, ...Object.entries(PLATFORM_LABELS).map(([value, label]) => ({ value, label }))]} onChange={resetPage(setPlatform)} ariaLabel="Filter by platform" />
        <FilterSelect value={campaign} options={[{ value: ALL, label: 'All campaigns' }, ...campaignOptions]} onChange={resetPage(setCampaign)} ariaLabel="Filter by campaign" />
        <FilterSelect value={landingPage} options={[{ value: ALL, label: 'All landing pages' }, ...lpOptions]} onChange={resetPage(setLandingPage)} ariaLabel="Filter by landing page" />
        <FilterSelect value={status} options={[{ value: ALL, label: 'Any status' }, ...Object.entries(STATUS_LABELS).map(([value, s]) => ({ value, label: s.label }))]} onChange={resetPage(setStatus)} ariaLabel="Filter by status" />
        <div className="crl-date">
          <input type="date" aria-label="Added from" value={from} max={to || undefined} onChange={(e) => resetPage(setFrom)(e.target.value)} />
          <span aria-hidden>–</span>
          <input type="date" aria-label="Added to" value={to} min={from || undefined} onChange={(e) => resetPage(setTo)(e.target.value)} />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card pad acard" data-testid="creative-bulk-bar" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{selected.size} selected</strong>
          <FilterSelect
            value={bulkAction}
            options={[
              { value: 'assign_landing_page', label: 'Assign landing page' },
              ...(clientId ? [] : [{ value: 'move_client', label: 'Move to client' }]),
              { value: 'submit_for_approval', label: 'Submit for approval' },
            ]}
            onChange={(v) => { setBulkAction(v as typeof bulkAction); setBulkTarget(NONE); }}
            ariaLabel="Bulk action"
            style={{ minWidth: 190 }}
          />
          {bulkAction === 'assign_landing_page' && (
            <FilterSelect value={bulkTarget} options={[{ value: NONE, label: lpOptions.length ? 'Choose landing page…' : 'No landing pages yet' }, ...lpOptions]} onChange={setBulkTarget} ariaLabel="Landing page for selected creatives" style={{ minWidth: 220 }} muted={bulkTarget === NONE} />
          )}
          {bulkAction === 'move_client' && (
            <FilterSelect value={bulkTarget} options={[{ value: NONE, label: 'Choose client…' }, ...clientOptions]} onChange={setBulkTarget} ariaLabel="Client for selected creatives" style={{ minWidth: 220 }} muted={bulkTarget === NONE} />
          )}
          <button type="button" className="btn b-dark b-sm" disabled={bulk.isPending || (bulkNeedsTarget && bulkTarget === NONE)} onClick={applyBulk}>
            {bulk.isPending ? <Loader2 className="size-[15px] animate-spin" /> : bulkAction === 'submit_for_approval' ? <Send className="size-[15px]" /> : null}
            Apply to {selected.size}
          </button>
          <button type="button" className="btn b-ghost b-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="card acard inv-card" aria-busy={isFetching || undefined}>
        {isLoading ? (
          <div className="crl-grid">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-48" />)}</div>
        ) : error ? (
          <div className="ph-screen">
            <span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span>
            <strong>Couldn't load creatives</strong>
            <p>{error instanceof Error ? error.message : 'Something went wrong reaching the server. Try refreshing the page.'}</p>
          </div>
        ) : creatives.length === 0 ? (
          <div className="ph-screen">
            <span className="ph-screen-ic"><ImageIcon className="size-[26px]" /></span>
            <strong>{filtered ? 'No creatives match' : 'No creatives yet'}</strong>
            <p>{filtered ? 'Try a different search or filter.' : 'Upload images and videos, or link ad accounts so synced ads are filed here automatically.'}</p>
            {!filtered && <button type="button" className="btn b-dark b-sm" onClick={() => setUploadOpen(true)}><Upload className="size-[15px]" /> Upload creatives</button>}
          </div>
        ) : (
          <>
            {view === 'table' && (
              <div className="hidden md:block table-scroll">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}><input type="checkbox" aria-label="Select all creatives on this page" checked={allOnPage} onChange={toggleAll} /></th>
                      <th>Creative</th>
                      {!clientId && <th>Client</th>}
                      <th>Platform</th>
                      <th>Campaign</th>
                      <th>Landing page</th>
                      <th>Status</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creatives.map((c) => (
                      <tr key={c.id} data-testid="creative-row">
                        <td><input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                        <td>
                          <button type="button" onClick={() => setOpenId(c.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} aria-label={`Open ${c.name}`}>
                            <span className="crl-mini"><Thumb c={c} small /></span>
                            <span style={{ minWidth: 0 }}>
                              <span className="crl-name" style={{ display: 'block', maxWidth: 240 }}>{c.name}</span>
                              <span className="crl-sub" style={{ display: 'block' }}>{dims(c) ?? formatBytes(c.sizeBytes)}</span>
                            </span>
                          </button>
                        </td>
                        {!clientId && <td>{c.clientName ?? (c.shared ? <span className="cmp-client">Shared on campaign</span> : '—')}</td>}
                        <td>{c.platform ? <span className="cmp-vpill">{PLATFORM_LABELS[c.platform] ?? c.platform}</span> : '—'}{c.platformAdId && <div className="cl-email mono">Ad {c.platformAdId}</div>}</td>
                        <td className="cmp-client">{c.campaignName ?? c.platformCampaignName ?? '—'}</td>
                        <td style={{ maxWidth: 220 }}>{c.landingPageUrl ? <a href={c.landingPageUrl} target="_blank" rel="noreferrer" className="crl-sub" style={{ display: 'block' }}>{c.landingPageUrl}</a> : '—'}</td>
                        <td><StatusPill status={c.status} /></td>
                        <td className="mono">{fmtDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Grid — always on phones (no sideways-scrolling table), and on desktop in grid view. */}
            <ul className={'crl-grid' + (view === 'table' ? ' md:hidden' : '')} data-testid="creative-grid" style={{ listStyle: 'none', margin: 0 }}>
              {creatives.map((c) => (
                <li key={c.id} className="crl-card" data-selected={selected.has(c.id) || undefined} data-testid="creative-card">
                  <label className="crl-check"><input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></label>
                  <button type="button" className="crl-thumb" onClick={() => setOpenId(c.id)} aria-label={`Open ${c.name}`}>
                    <Thumb c={c} />
                    {c.mediaType === 'video' && <span className="crl-play"><Play className="size-3" aria-hidden />{formatDuration(c.durationS) ?? 'Video'}</span>}
                  </button>
                  <div className="crl-meta">
                    <span className="crl-name" title={c.name}>{c.name}</span>
                    <span className="crl-sub">{clientId ? (c.campaignName ?? c.platformCampaignName ?? 'No campaign') : (c.clientName ?? (c.shared ? 'Shared on campaign' : 'No client'))}</span>
                    <span className="crl-tags">
                      {c.platform && <span className="cmp-vpill">{PLATFORM_LABELS[c.platform] ?? c.platform}</span>}
                      <StatusPill status={c.status} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="bf-pager">
              <span className="bf-count">Showing <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</strong> of <strong>{total}</strong></span>
              <div className="bf-pages">
                <button type="button" className="bf-pg-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></button>
                <button type="button" className="bf-pg-btn on" aria-current="page">{page}</button>
                <button type="button" className="bf-pg-btn" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>

      <CreativeDetailPanel id={openId} onClose={() => setOpenId(null)} clientOptions={clientOptions} lpOptions={lpOptions} fixedClient={!!clientId} />
      <CreativeUploader open={uploadOpen} onOpenChange={setUploadOpen} clientId={clientId} clientOptions={clientOptions} campaignOptions={campaignOptions} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, pill: 'gray' };
  return <span className={`pill p-${s.pill}`}>{s.label}</span>;
}

function Thumb({ c, small }: { c: LibraryCreative; small?: boolean }) {
  const src = c.thumbnailUrl ?? (c.mediaType === 'image' ? c.fileUrl : null);
  if (src) return <img src={src} alt="" loading="lazy" />;
  if (c.mediaType === 'video' && c.fileUrl) return <video src={`${c.fileUrl}#t=0.5`} muted preload="metadata" aria-hidden />;
  return c.mediaType === 'video' ? <FileVideo className={small ? 'size-5' : 'size-8'} aria-hidden /> : <ImageIcon className={small ? 'size-5' : 'size-8'} aria-hidden />;
}

function CreativeDetailPanel({ id, onClose, clientOptions, lpOptions, fixedClient }: {
  id: string | null; onClose: () => void; clientOptions: FilterOption[]; lpOptions: FilterOption[]; fixedClient: boolean;
}) {
  const { data: c, isLoading, error } = useLibraryCreative(id);
  const update = useUpdateLibraryCreative();

  async function save(patch: { clientId?: string | null; landingPageId?: string | null }) {
    if (!c) return;
    try {
      await update.mutateAsync({ id: c.id, ...patch });
      toast.success('Saved.');
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : "Couldn't save."} Nothing was changed.`);
    }
  }

  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{c?.name ?? 'Creative'}</SheetTitle>
          <SheetDescription>{c ? [c.clientName ?? (c.shared ? 'Shared on campaign' : 'No client'), c.campaignName].filter(Boolean).join(' · ') : 'Loading…'}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6" style={{ display: 'grid', gap: 16 }}>
          {isLoading && <Skeleton className="h-64" />}
          {error && <p className="crl-err">{error instanceof Error ? error.message : "Couldn't load this creative."}</p>}
          {c && (
            <>
              <div className="crl-panel-media">
                {c.mediaType === 'video' && c.fileUrl
                  ? <video src={c.fileUrl} poster={c.thumbnailUrl ?? undefined} controls preload="metadata" aria-label={`Video: ${c.name}`} />
                  : (c.fileUrl || c.thumbnailUrl) ? <img src={c.fileUrl ?? c.thumbnailUrl!} alt={c.headline ?? c.name} />
                  : <div style={{ padding: 40, color: '#fff', textAlign: 'center' }}>No preview</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {c.fileUrl && <a href={c.fileUrl} target="_blank" rel="noreferrer" download><button type="button" className="btn b-ghost b-sm"><Download className="size-[15px]" /> Download</button></a>}
                {c.landingPageUrl && <a href={c.landingPageUrl} target="_blank" rel="noreferrer"><button type="button" className="btn b-ghost b-sm"><ExternalLink className="size-[15px]" /> Open landing page</button></a>}
              </div>
              <dl className="crl-dl">
                <dt>Status</dt><dd><StatusPill status={c.status} /></dd>
                <dt>Platform</dt><dd>{c.platform ? PLATFORM_LABELS[c.platform] ?? c.platform : '—'}</dd>
                <dt>Platform ad ID</dt><dd className="mono">{c.platformAdId ?? '—'}</dd>
                <dt>Platform creative ID</dt><dd className="mono">{c.platformCreativeId ?? '—'}</dd>
                <dt>Platform campaign</dt><dd>{c.platformCampaignName ?? '—'}</dd>
                <dt>Headline</dt><dd>{c.headline ?? '—'}</dd>
                <dt>Text</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{c.bodyText ?? '—'}</dd>
                <dt>Landing page</dt><dd>{c.landingPageUrl ? <a href={c.landingPageUrl} target="_blank" rel="noreferrer">{c.landingPageUrl}</a> : '—'}</dd>
                <dt>Size</dt><dd>{[dims(c), formatBytes(c.sizeBytes), c.contentType].filter(Boolean).join(' · ')}</dd>
                <dt>First seen live</dt><dd>{fmtDate(c.firstSeen)}</dd>
                <dt>Last seen live</dt><dd>{fmtDate(c.lastSeen)}</dd>
                <dt>Added</dt><dd>{fmtDate(c.createdAt)}</dd>
              </dl>
              <div style={{ display: 'grid', gap: 10 }}>
                {!fixedClient && (
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span className="nc-label">Client</span>
                    <FilterSelect value={c.clientId ?? NONE} options={[{ value: NONE, label: 'No client' }, ...clientOptions]} onChange={(v) => save({ clientId: v === NONE ? null : v })} ariaLabel="Client for this creative" disabled={update.isPending} />
                  </label>
                )}
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="nc-label">Landing page</span>
                  <FilterSelect value={c.landingPageId ?? NONE} options={[{ value: NONE, label: 'No landing page' }, ...lpOptions]} onChange={(v) => save({ landingPageId: v === NONE ? null : v })} ariaLabel="Landing page for this creative" disabled={update.isPending} />
                </label>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
