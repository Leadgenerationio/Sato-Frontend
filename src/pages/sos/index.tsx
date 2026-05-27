import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LifeBuoy, CheckCircle2, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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
        className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="SOS help queue"
        description="Requests submitted via the floating SOS button"
      />

      {/* Summary card */}
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-lg bg-red-500/10">
            <LifeBuoy className="size-5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{openCount}</p>
            <p className="text-sm text-muted-foreground">Open requests</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(['open', 'resolved', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load the queue"
              description="Something went wrong reaching the server. Try refreshing the page."
            />
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={CheckCircle2}
              title={tab === 'open' ? 'Nothing to do — queue is empty' : 'No SOS requests yet'}
              description={
                tab === 'open'
                  ? 'No one has hit the SOS button recently. The button sits bottom-right on every page.'
                  : 'No requests match this filter.'
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((r) => (
                    <TableRow key={r.id} className={r.resolvedAt ? 'opacity-60' : ''}>
                      <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{userLabel(r)}</TableCell>
                      <TableCell>
                        {r.pagePath ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.pagePath}</code>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[360px]">
                        {r.message ? (
                          <p className="text-sm whitespace-pre-wrap">{renderMessageWithTaskLinks(r.message)}</p>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">(no message)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.resolvedAt ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-xs">
                            Resolved {formatDateTime(r.resolvedAt)}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-600 border-red-200 text-xs">
                            Open
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {extractFirstTaskId(r.message, r.pagePath) && (
                            <Link to={`/tasks/${extractFirstTaskId(r.message, r.pagePath)}`}>
                              <Button variant="outline" size="sm" aria-label="Open referenced task">
                                <ExternalLink className="size-4 mr-1.5" />
                                Open task
                              </Button>
                            </Link>
                          )}
                          {!r.resolvedAt && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolve(r.id)}
                              disabled={resolve.isPending}
                            >
                              {resolve.isPending && resolve.variables === r.id ? (
                                <Loader2 className="size-4 animate-spin mr-1.5" />
                              ) : (
                                <CheckCircle2 className="size-4 mr-1.5" />
                              )}
                              Mark resolved
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
