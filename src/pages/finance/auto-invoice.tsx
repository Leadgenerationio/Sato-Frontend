import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, ExternalLink, Loader2, PlayCircle, CheckCircle2, XCircle, SkipForward, Pause, Play, CircleCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAutoInvoiceRuns,
  useNextAutoInvoiceWindow,
  useRunAutoInvoiceNow,
  type AutoInvoiceRun,
} from '@/lib/hooks/use-auto-invoice';
import { useWorkflows, usePauseWorkflow, useResumeWorkflow } from '@/lib/hooks/use-workflows';

import { logError } from '../../lib/log';
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: AutoInvoiceRun['status'] }) {
  if (status === 'completed') {
    return <span className="pill p-pos"><CheckCircle2 className="size-3" /> Completed</span>;
  }
  if (status === 'failed') {
    return <span className="pill p-neg"><XCircle className="size-3" /> Failed</span>;
  }
  if (status === 'skipped') {
    return <span className="pill p-gray"><SkipForward className="size-3" /> Skipped</span>;
  }
  if (status === 'running') {
    return <span className="pill p-infosoft"><Loader2 className="size-3 animate-spin" /> Running</span>;
  }
  return <span className="pill p-gray" style={{ textTransform: 'capitalize' }}>{status}</span>;
}

export function AutoInvoicePage() {
  const { data: runs, isLoading } = useAutoInvoiceRuns(20);
  const { data: nextWindow } = useNextAutoInvoiceWindow();
  const runNow = useRunAutoInvoiceNow();

  // T4 (Sam, 2026-05-20): locate this automation's workflow row by handler
  // key so the pause/resume buttons can target it. List call is cached by
  // useWorkflows so this is essentially free.
  const { data: workflows } = useWorkflows();
  const autoInvoiceWorkflow = workflows?.find((w) => w.handlerKey === 'auto-invoice');
  const pauseWorkflow = usePauseWorkflow();
  const resumeWorkflow = useResumeWorkflow();
  const isPaused = autoInvoiceWorkflow?.status === 'paused';
  const isTogglePending = pauseWorkflow.isPending || resumeWorkflow.isPending;

  async function handleTogglePaused() {
    if (!autoInvoiceWorkflow) return;
    try {
      if (isPaused) {
        await resumeWorkflow.mutateAsync(autoInvoiceWorkflow.id);
        toast.success('Auto-invoice resumed — next run will fire on schedule');
      } else {
        await pauseWorkflow.mutateAsync(autoInvoiceWorkflow.id);
        toast.success('Auto-invoice paused — the cron will keep ticking but the handler will skip');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update workflow state');
    }
  }

  async function handleRunNow() {
    try {
      const result = await runNow.mutateAsync();
      if (result.status === 'skipped') {
        toast.info("This week was already reconciled against Xero. No duplicate run created.");
      } else if (result.status === 'completed') {
        toast.success(`Reconciled ${result.clientsBilled} client${result.clientsBilled === 1 ? '' : 's'} against Xero`);
      } else {
        toast.error('Auto-invoice run finished with errors. Check the run detail below.');
      }
    } catch (err) {
      logError('Auto-invoice manual run failed', err);
      toast.error(err instanceof Error ? err.message : 'Run failed');
    }
  }

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Auto-invoice</h1>
          <p className="ahead-sub">Weekly cron — pulls each client's invoices from Xero for clients with deliveries in the previous Mon-Sun</p>
        </div>
        <div className="page-actions">
          {autoInvoiceWorkflow && (
            <button
              className={'btn b-sm ' + (isPaused ? 'b-dark' : 'b-ghost')}
              onClick={handleTogglePaused}
              disabled={isTogglePending}
              title={isPaused ? 'Resume — handler will run again on the next cron tick' : 'Pause — cron keeps firing but the handler short-circuits'}
            >
              {isTogglePending ? <Loader2 className="size-[15px] animate-spin" /> : isPaused ? <Play className="size-[15px]" /> : <Pause className="size-[15px]" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          )}
          <button className="btn b-ghost b-sm" onClick={handleRunNow} disabled={runNow.isPending || isPaused}>
            {runNow.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <PlayCircle className="size-[15px]" />}
            Run now
          </button>
        </div>
      </div>

      {isPaused ? (
        <div className="ai-banner warn">
          <span className="lic"><Pause className="size-4" /></span>
          <span><strong>Auto-invoice is paused.</strong> The Monday 09:00 UTC cron will continue to fire, but the handler skips until you click <strong>Resume</strong>.</span>
        </div>
      ) : autoInvoiceWorkflow ? (
        <div className="ai-banner ok">
          <span className="lic"><CircleCheck className="size-4" /></span>
          <span><strong>Auto-invoice is active.</strong> The Monday 09:00 UTC cron will reconcile each client's Xero invoices automatically.</span>
        </div>
      ) : null}

      <div className="card pad acard">
        <div className="ai-next-head"><span className="lic"><Calendar className="size-[18px]" /></span> <h3 className="statto-title">Next run</h3></div>
        <p className="ai-next-when">{nextWindow?.schedule ?? 'Mondays 09:00 UTC'}</p>
        {nextWindow ? (
          <p className="ai-next-desc">
            Will reconcile the week <strong>{formatDate(nextWindow.fromDate)}</strong> through <strong>{formatDate(nextWindow.toDate)}</strong>.
            For each client with deliveries in that window, we pull their latest invoices from Xero — amounts and numbers come from Xero, not from lead values.
          </p>
        ) : (
          <Skeleton className="h-5 w-72" />
        )}
      </div>

      <div className="card acard inv-card">
        <div className="ai-runs-head">
          <h3 className="statto-title">Recent runs</h3>
          <p className="ac-sub">The 20 most recent auto-invoice runs (scheduled + manual)</p>
        </div>

        {isLoading && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}

        {!isLoading && runs && runs.length === 0 && (
          <div className="inv-empty">
            No runs yet — the first auto-invoice run fires Monday 09:00 UTC, or you can trigger one now from the Run-now button.
          </div>
        )}

        {!isLoading && runs && runs.length > 0 && (
          <table className="inv-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Status</th>
                <th>Trigger</th>
                <th className="r">Imported</th>
                <th className="r">Clients</th>
                <th>Started</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="inv-id">{formatDate(r.periodFrom)} → {formatDate(r.periodTo)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td><span className="pill p-gray">{r.triggeredBy}</span></td>
                  <td className="r mono inv-num">
                    {r.invoicesCreated}
                    {(r.clientsFailed > 0 || r.clientsSkipped > 0) && (
                      <span className="inv-date" style={{ marginLeft: 4, fontSize: 12 }}>
                        (+{r.clientsSkipped}↷ {r.clientsFailed}✗)
                      </span>
                    )}
                  </td>
                  <td className="r mono">{r.clientsBilled}</td>
                  <td className="inv-date">{formatDateTime(r.startedAt)}</td>
                  <td className="r">
                    <Link to={`/finance/auto-invoice/${r.id}`} className="inv-open" title="View run">
                      <ExternalLink className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
