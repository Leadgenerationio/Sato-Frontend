import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Clock, CheckCircle2, Pause, Play, Workflow, Plus, Loader2 } from 'lucide-react';
import { useWorkflows, usePauseWorkflow, useResumeWorkflow, type WorkflowSummary } from '@/lib/hooks/use-workflows';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  active: 'bg-positive/10 text-positive border-positive/30',
  paused: 'bg-warning/10 text-warning border-warning/30',
  draft: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
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
    <Button
      variant={isPaused ? 'default' : 'outline'}
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      title={isPaused ? 'Resume — cron will fire the handler again' : 'Pause — cron keeps ticking but handler short-circuits'}
    >
      {isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : isPaused ? <Play className="size-4 mr-1.5" /> : <Pause className="size-4 mr-1.5" />}
      {isPaused ? 'Resume' : 'Pause'}
    </Button>
  );
}

export function WorkflowsPage() {
  const { data: workflows, isLoading } = useWorkflows();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Workflows" description="Automated business processes">
        <Link to="/workflows/create">
          <Button size="sm"><Plus className="size-4 mr-1.5" />New Workflow</Button>
        </Link>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : !workflows?.length ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Workflow}
              title="No workflows yet"
              description="Workflows automate recurring tasks like weekly invoicing, credit checks, and chasing overdue invoices."
              link={{ label: 'New workflow', to: '/workflows/create', icon: Plus }}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {workflows.map((wf) => {
            const StatusIcon = statusIcons[wf.status] || Clock;
            return (
              <Card key={wf.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold">{wf.name}</h3>
                        <Badge className={`text-xs capitalize ${statusColors[wf.status] || ''}`}>
                          <StatusIcon className="size-3 mr-1" />
                          {wf.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{wf.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {wf.schedule && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="size-3.5" />
                            {wf.schedule}
                          </span>
                        )}
                        <span>{wf.totalRuns} runs</span>
                        <span>{wf.successRate}% success</span>
                        {wf.lastRunAt && <span>Last: {formatDate(wf.lastRunAt)}</span>}
                        {wf.nextRunAt && <span>Next: {formatDate(wf.nextRunAt)}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PauseResumeButton workflow={wf} />
                      <Link to={`/workflows/${wf.id}`}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="size-4 mr-1.5" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
