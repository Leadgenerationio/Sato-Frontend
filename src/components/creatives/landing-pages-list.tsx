import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Globe, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FilterSelect, type FilterOption } from '@/components/ui/filter-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useClients } from '@/lib/hooks/use-clients';
import { useCreateLandingPage, useDeleteLandingPage, useLandingPages, type LandingPage } from '@/lib/hooks/use-creative-library';
import { landingUrlError, normaliseLandingUrl } from '@/lib/creative-files';
import '@/creative-library.css';

// Landing pages as their own records (Sam feedback round 1, M2 — plan phase
// 1): stored per client, the URL normalised so the same page from two ads is
// one record, with the number of creatives pointing at it.

const ALL = 'all';
const NONE = '__none__';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function LandingPagesList({ clientId }: { clientId?: string }) {
  const [client, setClient] = useState(ALL);
  const [q, setQ] = useState('');
  const [newClient, setNewClient] = useState(clientId ?? NONE);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [touched, setTouched] = useState(false);

  const effectiveClient = clientId ?? (client === ALL ? undefined : client);
  const { data: pages, isLoading, error } = useLandingPages({ clientId: effectiveClient, q: q.trim() || undefined });
  const { data: clientsData } = useClients({ limit: 100 });
  const create = useCreateLandingPage();
  const del = useDeleteLandingPage();

  const clientOptions: FilterOption[] = useMemo(
    () => (clientsData?.clients ?? []).map((c) => ({ value: c.id, label: c.companyName })), [clientsData]);

  const urlErr = touched ? landingUrlError(url) : null;
  const normalised = normaliseLandingUrl(url);
  const clientMissing = (clientId ?? newClient) === NONE;
  const duplicate = normalised && (pages ?? []).some((p) => p.normalisedUrl === normalised && p.clientId === (clientId ?? newClient));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (landingUrlError(url) || clientMissing || duplicate) return;
    try {
      await create.mutateAsync({ clientId: clientId ?? newClient, url: url.trim(), title: title.trim() || undefined });
      toast.success('Landing page added.');
      setUrl(''); setTitle(''); setTouched(false);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : "Couldn't add the landing page."} Nothing was saved.`);
    }
  }

  async function remove(p: LandingPage) {
    if (p.creativesCount > 0) { toast.error(`${p.creativesCount} creative${p.creativesCount === 1 ? ' uses' : 's use'} this page — reassign them first.`); return; }
    if (!window.confirm(`Remove ${p.normalisedUrl}?`)) return;
    try { await del.mutateAsync(p.id); toast.success('Landing page removed.'); }
    catch (err) { toast.error(`${err instanceof Error ? err.message : "Couldn't remove it."} Nothing was changed.`); }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <form className="card pad acard" onSubmit={add} noValidate style={{ display: 'grid', gap: 10 }} aria-label="Add a landing page">
        <h3 className="statto-title">Add a landing page</h3>
        <div className="crl-filters" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {!clientId && (
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="nc-label">Client *</span>
              <FilterSelect value={newClient} options={[{ value: NONE, label: 'Choose a client…' }, ...clientOptions]} onChange={setNewClient} ariaLabel="Client for the new landing page" muted={newClient === NONE} />
            </label>
          )}
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="nc-label">URL *</span>
            <input className="nc-input" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => setTouched(true)} placeholder="https://example.com/offer" aria-invalid={!!urlErr || !!duplicate} aria-describedby="lp-url-msg" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="nc-label">Title (optional)</span>
            <input className="nc-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Spring offer" />
          </label>
        </div>
        <span id="lp-url-msg" className={urlErr || duplicate || (touched && clientMissing) ? 'crl-err' : 'ac-sub'} style={{ marginTop: 0 }} role={urlErr || duplicate ? 'alert' : undefined}>
          {urlErr ?? (duplicate ? 'This client already has that landing page.' : touched && clientMissing ? 'Choose the client this page belongs to.'
            : normalised && normalised !== url.trim() ? `Saved as ${normalised} (tracking tags removed).` : 'Tracking tags like utm_source are removed so the same page is stored once.')}
        </span>
        <div><button type="submit" className="btn b-dark b-sm" disabled={create.isPending}>{create.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <Plus className="size-[15px]" />} Add landing page</button></div>
      </form>

      <div className="inv-toolbar">
        <div className="inv-search" style={{ flex: 1, minWidth: 200 }}>
          <Search className="size-4" />
          <input placeholder="Search URL or title…" aria-label="Search landing pages" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!clientId && <FilterSelect value={client} options={[{ value: ALL, label: 'All clients' }, ...clientOptions]} onChange={setClient} ariaLabel="Filter landing pages by client" style={{ minWidth: 200 }} />}
      </div>

      <div className="card acard inv-card">
        {isLoading ? <div style={{ padding: 16, display: 'grid', gap: 8 }}><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        : error ? (
          <div className="ph-screen">
            <span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span>
            <strong>Couldn't load landing pages</strong>
            <p>{error instanceof Error ? error.message : 'Something went wrong reaching the server. Try refreshing the page.'}</p>
          </div>
        ) : !pages?.length ? (
          <div className="ph-screen">
            <span className="ph-screen-ic"><Globe className="size-[26px]" /></span>
            <strong>{q || client !== ALL ? 'No landing pages match' : 'No landing pages yet'}</strong>
            <p>Add one above, or give a creative a landing page URL when you upload it.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block table-scroll">
              <table className="inv-table">
                <thead><tr><th>Landing page</th>{!clientId && <th>Client</th>}<th className="r">Creatives</th><th>Added</th>{/* aria-label, not a .sr-only span: that span is position:absolute and escapes .table-scroll, so the page scrolled sideways at 768px. */}<th aria-label="Actions" /></tr></thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id} data-testid="landing-page-row">
                      <td style={{ maxWidth: 420 }}>
                        <div className="cl-contact">{p.title ?? p.normalisedUrl}</div>
                        <a href={p.url} target="_blank" rel="noreferrer" className="cl-email" style={{ overflowWrap: 'anywhere' }}>{p.normalisedUrl}</a>
                      </td>
                      {!clientId && <td>{p.clientId ? <Link to={`/clients/${p.clientId}`}>{p.clientName ?? 'Client'}</Link> : '—'}</td>}
                      <td className="r mono">{p.creativesCount}</td>
                      <td className="mono">{fmtDate(p.createdAt)}</td>
                      <td className="r" style={{ whiteSpace: 'nowrap' }}>
                        <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Open ${p.normalisedUrl}`} title="Open page" className="inv-open"><ExternalLink className="size-4" /></a>
                        <button type="button" className="inv-open" aria-label={`Remove ${p.normalisedUrl}`} title="Remove" onClick={() => remove(p)}><Trash2 className="size-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="crl-list md:hidden" data-testid="landing-page-cards">
              {pages.map((p) => (
                <li key={p.id}>
                  <div className="cl-contact">{p.title ?? p.normalisedUrl}</div>
                  <a href={p.url} target="_blank" rel="noreferrer" className="cl-email" style={{ overflowWrap: 'anywhere' }}>{p.normalisedUrl}</a>
                  <div className="crl-sub">{[clientId ? null : p.clientName, `${p.creativesCount} creative${p.creativesCount === 1 ? '' : 's'}`, fmtDate(p.createdAt)].filter(Boolean).join(' · ')}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href={p.url} target="_blank" rel="noreferrer"><button type="button" className="btn b-ghost b-sm"><ExternalLink className="size-[15px]" /> Open</button></a>
                    <button type="button" className="btn b-ghost b-sm" onClick={() => remove(p)} aria-label={`Remove ${p.normalisedUrl}`}><Trash2 className="size-[15px]" /> Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
