import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Clock, CheckCircle2, Pause, Play, Workflow, Plus, Loader2 } from 'lucide-react';
import { useWorkflows, usePauseWorkflow, useResumeWorkflow, type WorkflowSummary } from '@/lib/hooks/use-workflows';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';

const statusPill: Record<string, string> = {
  active: 'pos',
  paused: 'wfpause',
  draft: 'gray',
};

const statusIcons: Record<string, React.ElementType> = {
  active: CheckCircle2,
  paused: Pause,
  draft: Clock,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// T4 (Sam, 2026-05-20) — inline pause/resume button on every row, so
// any workflow (auto-invoice or otherwise) can be stopped from the same
// generic admin surface without engineer help.
function PauseResumeButton({ workflow }: { workflow: WorkflowSummary }) {
  const pause = usePauseWorkflow();
  const resume = useResumeWorkflow();
  const isPaused = workflow.status === 'paused';
  const isPending = pause.isPending || resume.isPending;

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isPaused) {
        await resume.mutateAsync(workflow.id);
        toast.success(`Resumed "${workflow.name}"`);
      } else {
        await pause.mutateAsync(workflow.id);
        toast.success(`Paused "${workflow.name}"`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  // Draft workflows have no live cron behind them yet — show nothing so
  // staff don't accidentally "pause" a workflow that isn't scheduled.
  if (workflow.status === 'draft') return null;

  return (
    <button
      type="button"
      className="btn b-dark b-sm"
      onClick={handleClick}
      disabled={isPending}
      title={isPaused ? 'Resume — cron will fire the handler again' : 'Pause — cron keeps ticking but handler short-circuits'}
    >
      {isPending ? <Loader2 className="size-[15px] animate-spin" /> : isPaused ? <Play className="size-[15px]" /> : <Pause className="size-[15px]" />}
      {isPaused ? 'Resume' : 'Pause'}
    </button>
  );
}

export function WorkflowsPage() {
  const { data: workflows, isLoading } = useWorkflows();

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Workflows</h1>
          <p className="ahead-sub">Automated business processes</p>
        </div>
        <div className="page-actions">
          <Link to="/workflows/create">
            <button type="button" className="btn b-dark b-sm"><Plus className="size-[15px]" />New Workflow</button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="wf-list">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : !workflows?.length ? (
        <div className="card acard">
          <EmptyState
            icon={Workflow}
            title="No workflows yet"
            description="Workflows automate recurring tasks like weekly invoicing, credit checks, and chasing overdue invoices."
            link={{ label: 'New workflow', to: '/workflows/create', icon: Plus }}
          />
        </div>
      ) : (
        <div className="wf-list">
          {workflows.map((wf) => {
            const StatusIcon = statusIcons[wf.status] || Clock;
            return (
              <div key={wf.id} className="card pad acard wf-card">
                <div className="wf-main">
                  <div className="wf-titlerow">
                    <h3 className="wf-name">{wf.name}</h3>
                    <span className={'pill p-' + (statusPill[wf.status] || 'gray')} style={{ textTransform: 'capitalize' }}>
                      <StatusIcon className="size-3" strokeWidth={2.4} />
                      {wf.status}
                    </span>
                  </div>
                  <p className="wf-desc">{wf.description}</p>
                  <div className="wf-meta">
                    {wf.schedule && (
                      <span className="wf-meta-item">
                        <Clock className="size-[15px]" />
                        {wf.schedule}
                      </span>
                    )}
                    <span className="wf-meta-item">{wf.totalRuns} runs</span>
                    <span className="wf-meta-item">{wf.successRate}% success</span>
                    {wf.lastRunAt && <span className="wf-meta-item">Last: {formatDate(wf.lastRunAt)}</span>}
                    {wf.nextRunAt && <span className="wf-meta-item">Next: {formatDate(wf.nextRunAt)}</span>}
                  </div>
                </div>
                <div className="wf-actions">
                  <PauseResumeButton workflow={wf} />
                  <Link to={`/workflows/${wf.id}`}>
                    <button type="button" className="btn b-ghost b-sm">
                      <ExternalLink className="size-[15px]" />
                      View
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
