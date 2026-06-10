import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Download, CheckCircle2, AlertTriangle, Loader2, ChevronRight, TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useBrowseAttio, useImportFromAttio,
  type ImportResult,
} from '@/lib/hooks/use-attio-import';

// #39 Attio bulk import. Page flow:
//   1. Browse Attio companies (search + cursor pagination).
//   2. Tick the ones you want, click "Import N companies".
//   3. Server creates Stato clients, returns per-row results.
//   4. Results panel below the table.

export function ClientImportPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  const browse = useBrowseAttio({ search: search || undefined, cursor });
  const importMutation = useImportFromAttio();

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setCursor(undefined);
    setSelected(new Set());
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    try {
      const result = await importMutation.mutateAsync(Array.from(selected));
      setLastResult(result);
      setSelected(new Set());
      toast.success(`Import done — ${result.created} created, ${result.skipped} skipped, ${result.errors} errored`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      toast.error(msg);
    }
  };

  // Configuration error from the server (503) — surface a friendly state
  // distinct from "Attio responded with no results".
  const notConfigured = browse.error instanceof Error && /not configured/i.test(browse.error.message);

  const visible = browse.data?.companies ?? [];

  return (
    <div className="screen-page nc-page">
      <div className="page-head">
        <div className="nc-title-row">
          <button className="nc-back" onClick={() => navigate('/clients')} title="Back to clients"><ArrowLeft className="size-5" /></button>
          <div>
            <h1 className="ahead-title">Import clients from Attio</h1>
            <p className="ahead-sub">Pick companies in your Attio CRM to bring in as Stato clients.</p>
          </div>
        </div>
      </div>

      {notConfigured ? (
        <div className="card pad acard attio-card">
          <div className="attio-empty">
            <span className="attio-ic"><TriangleAlert className="size-[30px]" /></span>
            <h3>Attio not configured</h3>
            <p>Add <code>ATTIO_API_KEY</code> to the backend environment to enable importing. Once set, this page reads your Attio companies directly.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Search + import bar */}
          <div className="card pad acard">
            <div className="cl-inv-filters" style={{ marginTop: 0 }}>
              <form onSubmit={handleSearch} className="inv-search" style={{ flex: 1 }}>
                <Search className="size-4" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search company name in Attio…"
                />
              </form>
              <button type="button" className="btn b-ghost b-sm" onClick={handleSearch}>Search</button>
              <button
                type="button"
                className="btn b-dark b-sm"
                onClick={handleImport}
                disabled={selected.size === 0 || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Import {selected.size > 0 ? selected.size : ''} compan{selected.size === 1 ? 'y' : 'ies'}
              </button>
            </div>
          </div>

          {/* Companies table */}
          {browse.isLoading ? (
            <div className="card pad acard">
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--fg2)' }}>Loading companies from Attio…</div>
            </div>
          ) : browse.error && !notConfigured ? (
            <div className="card pad acard">
              <div className="ph-screen">
                <span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span>
                <strong>Couldn't reach Attio</strong>
                <p>{browse.error instanceof Error ? browse.error.message : 'Try refreshing the page.'}</p>
              </div>
            </div>
          ) : visible.length === 0 ? (
            <div className="card pad acard">
              <div className="ph-screen">
                <span className="ph-screen-ic"><Search className="size-[26px]" /></span>
                <strong>{search ? 'No companies match your search' : 'No companies in Attio'}</strong>
                <p>{search ? 'Try a different search term.' : 'Add companies in Attio first, then come back here.'}</p>
              </div>
            </div>
          ) : (
            <div className="card acard inv-card">
              <div className="table-scroll">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Company</th>
                      <th>Domain</th>
                      <th>Industry</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((c) => {
                      const isImported = !!c.existingClientId;
                      const isSelected = selected.has(c.recordId);
                      return (
                        <tr key={c.recordId} style={isImported ? { opacity: 0.6 } : undefined}>
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isImported}
                              onChange={() => toggleSelect(c.recordId)}
                              aria-label={`Select ${c.name ?? c.recordId}`}
                            />
                          </td>
                          <td className="cl-company">{c.name || '(unnamed)'}</td>
                          <td className="rpt-ncp">{c.domain || '—'}</td>
                          <td className="rpt-ncp">{c.industry || '—'}</td>
                          <td>
                            {isImported ? (
                              <Link
                                to={`/clients/${c.existingClientId}`}
                                className="cl-contact-email"
                                style={{ textDecoration: 'none' }}
                              >
                                Already imported
                                <ChevronRight className="size-3" />
                              </Link>
                            ) : (
                              <span className="pill p-infosoft">Importable</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {browse.data?.nextCursor && (
                <div className="bf-pager">
                  <span className="bf-count">{visible.length} on this page</span>
                  <button className="btn b-ghost b-sm" onClick={() => setCursor(browse.data!.nextCursor ?? undefined)}>
                    Next page
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Results panel after import */}
          {lastResult && (
            <div className="card pad acard">
              <h3 className="statto-title cl-sec-h">
                <CheckCircle2 className="size-[18px]" style={{ color: 'var(--positive)' }} />
                Last import — {lastResult.created} created, {lastResult.skipped} skipped, {lastResult.errors} errored
              </h3>
              <p className="ac-sub" style={{ marginTop: 4, marginBottom: 18 }}>
                {lastResult.created > 0
                  ? 'Click any "created" row to open the new client and fill in contact + billing details.'
                  : 'No new clients created — see per-row reasons below.'}
              </p>
              <div className="set-fields" style={{ gap: 8 }}>
                {lastResult.rows.map((r) => (
                  <div
                    key={r.attioCompanyId}
                    className="cl-contact-card"
                  >
                    <span className={'pill p-' + (r.status === 'created' ? 'pos' : r.status === 'skipped' ? 'warn' : 'neg')} style={{ textTransform: 'capitalize' }}>
                      {r.status}
                    </span>
                    <span className="cl-contact-name" style={{ flex: 1 }}>{r.attioName || r.attioCompanyId}</span>
                    {r.reason && <span className="cl-email">{r.reason}</span>}
                    {r.clientId && (
                      <button
                        className="btn b-ghost b-sm"
                        onClick={() => navigate(`/clients/${r.clientId}`)}
                      >
                        Open
                        <ChevronRight className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
