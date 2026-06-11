import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { LifeBuoy, CheckCircle2, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useListSos, useResolveSos, type SosHelpRequest } from '@/lib/hooks/use-sos';
import { EmptyState } from '@/components/shared/empty-state';

// Sam-Loom feedback (jam-video #3): the SOS message often contains
// references like "stuck on /tasks/abc". Render those as clickable links
// to the task detail page so the operator can jump straight to context.
// Match `/tasks/<id>` where <id> is any non-whitespace, non-punctuation-ish
// run — covers UUIDs, slugs, and the truncated forms Sam dictates aloud.
const TASK_LINK_RE = /\/tasks?\/([\w-]+)/g;

// Sam-Loom #11 — "I don't know what the action is here, what we can do".
// If the SOS row points at a task — either explicitly in the message body
// ("stuck on /tasks/abc") OR via the page-path field (the floating SOS
// button captures wherever the user was when they hit it) — surface an
// explicit "Open task" CTA so the operator can jump straight to context.
function extractFirstTaskId(message: string | null | undefined, pagePath?: string | null): string | null {
  for (const haystack of [message, pagePath]) {
    if (!haystack) continue;
    TASK_LINK_RE.lastIndex = 0;
    const match = TASK_LINK_RE.exec(haystack);
    if (match) return match[1];
  }
  return null;
}

function renderMessageWithTaskLinks(message: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TASK_LINK_RE.lastIndex = 0;
  while ((match = TASK_LINK_RE.exec(message)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={`t-${lastIndex}`}>{message.slice(lastIndex, match.index)}</Fragment>);
    }
    parts.push(
      <Link
        key={`l-${match.index}`}
        to={`/tasks/${match[1]}`}
        className="underline underline-offset-2"
        style={{ color: 'var(--lime-600)' }}
      >
        {match[0]}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < message.length) {
    parts.push(<Fragment key={`t-${lastIndex}`}>{message.slice(lastIndex)}</Fragment>);
  }
  return parts.length > 0 ? parts : message;
}

// Slice 5 Day 7 (Sam Loom #100). Admin queue for SOS button presses.
// Two tabs: Open vs Resolved. Owner / ops / finance can mark resolved.
// Backend already gates the list+resolve endpoints to internal roles.

function formatDateTime(s: string): string {
  return new Date(s).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function userLabel(req: SosHelpRequest): string {
  return req.userName || req.userEmail || 'Unknown user';
}

export function SosAdminPage() {
  const [tab, setTab] = useState<'open' | 'resolved' | 'all'>('open');
  const { data: requests, isLoading, error } = useListSos({
    unresolvedOnly: tab === 'open',
    limit: 200,
  });
  const resolve = useResolveSos();

  const visible = (requests ?? []).filter((r) => {
    if (tab === 'resolved') return !!r.resolvedAt;
    if (tab === 'open') return !r.resolvedAt;
    return true;
  });

  const openCount = (requests ?? []).filter((r) => !r.resolvedAt).length;

  const handleResolve = async (id: string) => {
    try {
      await resolve.mutateAsync(id);
      toast.success('Marked as resolved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark resolved');
    }
  };

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">SOS help queue</h1>
          <p className="ahead-sub">Requests submitted via the floating SOS button</p>
        </div>
      </div>

      {/* Summary tile */}
      <div className="card pad acard sos-stat">
        <span className="sos-stat-ic"><LifeBuoy className="size-5" /></span>
        <div>
          <div className="sos-stat-v">{openCount}</div>
          <div className="sos-stat-l">Open requests</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="seg sos-seg">
        {(['open', 'resolved', 'all'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={'seg-btn' + (tab === t ? ' on' : '')}
            style={{ textTransform: 'capitalize' }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card pad acard" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : error ? (
        <div className="card acard">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load the queue"
            description="Something went wrong reaching the server. Try refreshing the page."
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="card acard">
          <EmptyState
            icon={CheckCircle2}
            title={tab === 'open' ? 'Nothing to do — queue is empty' : 'No SOS requests yet'}
            description={
              tab === 'open'
                ? 'No one has hit the SOS button recently. The button sits bottom-right on every page.'
                : 'No requests match this filter.'
            }
          />
        </div>
      ) : (
        <div className="card acard inv-card">
          <div className="table-scroll">
            <table className="inv-table sos-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>From</th>
                  <th>Page</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th className="r">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} style={r.resolvedAt ? { opacity: 0.6 } : undefined}>
                    <td className="inv-date">{formatDateTime(r.createdAt)}</td>
                    <td className="sos-from">{userLabel(r)}</td>
                    <td>
                      {/* Sam (27 May 2026): "Page should be a clickable
                          link." Internal paths (starting with /) become
                          react-router Link so the operator can jump
                          straight to where the user was stuck. Anything
                          else (absolute URLs, weird input) renders as
                          plain code text to avoid broken navigation. */}
                      {r.pagePath ? (
                        r.pagePath.startsWith('/') ? (
                          <Link to={r.pagePath} className="sos-page">
                            {r.pagePath}
                          </Link>
                        ) : (
                          <code className="sos-page" style={{ textDecoration: 'none' }}>{r.pagePath}</code>
                        )
                      ) : (
                        <span className="inv-date">—</span>
                      )}
                    </td>
                    <td className="max-w-[360px]" style={{ whiteSpace: 'normal' }}>
                      {r.message ? (
                        <p className="sos-msg whitespace-pre-wrap">{renderMessageWithTaskLinks(r.message)}</p>
                      ) : (
                        <span className="sos-msg none">(no message)</span>
                      )}
                    </td>
                    <td>
                      {r.resolvedAt ? (
                        <span className="pill p-pos">Resolved {formatDateTime(r.resolvedAt)}</span>
                      ) : (
                        <span className="pill p-neg">Open</span>
                      )}
                    </td>
                    <td className="r">
                      <div className="sos-actions">
                        {extractFirstTaskId(r.message, r.pagePath) && (
                          <Link to={`/tasks/${extractFirstTaskId(r.message, r.pagePath)}`}>
                            <button type="button" className="btn b-ghost b-xs" aria-label="Open referenced task">
                              <ExternalLink className="size-4" />
                              Open task
                            </button>
                          </Link>
                        )}
                        {!r.resolvedAt && (
                          <button
                            type="button"
                            className="btn b-ghost b-xs"
                            onClick={() => handleResolve(r.id)}
                            disabled={resolve.isPending}
                          >
                            {resolve.isPending && resolve.variables === r.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-4" />
                            )}
                            Mark resolved
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
