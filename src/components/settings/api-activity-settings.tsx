import { useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { ApiKey } from '@/lib/hooks/use-integrations-api';
import { useApiActivity, type ApiActivityFilters, type ApiActivityItem } from '@/lib/hooks/use-api-activity';

// Settings → API keys → Activity (MCP spec v1.0 §3, Sam's test 16): every call
// an API key made, REST or MCP, with the bot name, the tool, the result and
// the records it touched. Owner only, like the rest of this tab.

function when(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** What was called, in a few words: the MCP tool, else the REST method and path. */
function callLabel(a: ApiActivityItem) {
  if (a.tool) return a.tool;
  if (a.transport === 'mcp') return 'MCP request';
  return `${a.method ?? ''} ${a.path ?? ''}`.trim();
}

function Outcome({ a }: { a: ApiActivityItem }) {
  if (!a.errorCode) return <span className="pill p-pos">OK</span>;
  return <span className="pill p-neg" title={a.status ? `HTTP ${a.status}` : undefined}>{a.errorCode}</span>;
}

const hasContent = (v: unknown) => v != null && !(typeof v === 'object' && Object.keys(v as object).length === 0);

function Json({ label, value }: { label: string; value: unknown }) {
  if (!hasContent(value)) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd><pre className="api-act-json">{JSON.stringify(value, null, 2)}</pre></dd>
    </>
  );
}

function Row({ a }: { a: ApiActivityItem }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <li data-testid="api-activity-row">
      <button type="button" className="api-act-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon className="size-[15px] api-act-chev" aria-hidden />
        <span className="api-act-call">
          <span className="cl-contact mono">{callLabel(a)}</span>
          <span className="crl-sub">
            {when(a.at)} · {a.keyName ?? 'Deleted key'}{a.agent && a.agent !== a.keyName ? ` · ${a.agent}` : ''} · {a.transport === 'mcp' ? 'MCP' : 'REST'}
            {a.durationMs != null ? ` · ${a.durationMs} ms` : ''}
          </span>
        </span>
        <Outcome a={a} />
      </button>
      {open && (
        <dl className="crl-dl api-act-detail">
          {a.owner && (<><dt>Key owner</dt><dd>{a.owner}</dd></>)}
          {a.transport === 'rest' && a.path && (<><dt>Request</dt><dd className="mono">{a.method} {a.path}</dd></>)}
          {a.status != null && (<><dt>HTTP status</dt><dd>{a.status}</dd></>)}
          {a.requestId && (<><dt>Request ID</dt><dd className="mono">{a.requestId}</dd></>)}
          {a.ip && (<><dt>IP</dt><dd className="mono">{a.ip.replace(/^::ffff:/, '')}</dd></>)}
          {a.recordsTouched?.length ? (
            <><dt>Records touched</dt><dd>{a.recordsTouched.map((r) => <div key={`${r.type}:${r.id}`} className="mono">{r.type} {r.id}</div>)}</dd></>
          ) : null}
          <Json label="Arguments" value={a.args} />
          <Json label="Before" value={a.before} />
          <Json label="After" value={a.after} />
        </dl>
      )}
    </li>
  );
}

export function ApiActivitySettings({ keys }: { keys: ApiKey[] }) {
  const [filters, setFilters] = useState<ApiActivityFilters>({});
  const q = useApiActivity(filters);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const set = <K extends keyof ApiActivityFilters>(k: K, v: string) =>
    setFilters((f) => ({ ...f, [k]: (v || undefined) as ApiActivityFilters[K] }));

  return (
    <div className="card acard inv-card" data-testid="api-activity">
      <div style={{ padding: '14px 16px', display: 'grid', gap: 10, borderBottom: '1px solid var(--border)' }}>
        <div>
          <h3 className="statto-title">Activity</h3>
          <p className="ac-sub" style={{ marginTop: 4 }}>Every call made with an API key, newest first: which key and bot, what it called, and what happened. Passwords, keys and file contents are never stored. Kept for 12 months.</p>
        </div>
        <div className="api-act-filters" role="group" aria-label="Filter activity">
          <label><span className="nc-label">Key</span>
            <select className="nc-select" value={filters.keyId ?? ''} onChange={(e) => set('keyId', e.target.value)}>
              <option value="">All keys</option>
              {keys.map((k) => <option key={k.id} value={k.id}>{k.name}{k.revokedAt ? ' (revoked)' : ''}</option>)}
            </select>
          </label>
          <label><span className="nc-label">Through</span>
            <select className="nc-select" value={filters.transport ?? ''} onChange={(e) => set('transport', e.target.value)}>
              <option value="">REST and MCP</option>
              <option value="mcp">MCP (AI assistants)</option>
              <option value="rest">REST API</option>
            </select>
          </label>
          <label><span className="nc-label">Result</span>
            <select className="nc-select" value={filters.outcome ?? ''} onChange={(e) => set('outcome', e.target.value)}>
              <option value="">All</option>
              <option value="ok">OK</option>
              <option value="error">Errors</option>
            </select>
          </label>
        </div>
      </div>

      {q.isLoading ? <div style={{ padding: 16 }}><Skeleton className="h-24" /></div>
      : q.error ? (
        <div className="ph-screen"><span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span><strong>Couldn't load the activity</strong><p>{q.error instanceof Error ? q.error.message : 'Try refreshing the page.'}</p></div>
      ) : !items.length ? (
        <div className="ph-screen"><span className="ph-screen-ic"><Activity className="size-[26px]" /></span><strong>No calls yet</strong><p>{Object.values(filters).some(Boolean) ? 'Nothing matches these filters.' : 'Calls made with an API key show up here.'}</p></div>
      ) : (
        <>
          <ul className="crl-list api-act-list" aria-label="API activity">
            {items.map((a) => <Row key={a.id} a={a} />)}
          </ul>
          {q.hasNextPage && (
            <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>
              <button type="button" className="btn b-ghost b-sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage && <Loader2 className="size-[15px] animate-spin" />} Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
