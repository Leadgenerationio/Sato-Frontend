import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Pause, Play, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWorkflow, useToggleWorkflowStatus, useExecuteWorkflow } from '@/lib/hooks/use-workflows';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  draft: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

const execStatusColors: Record<string, string> = {
  completed: 'text-emerald-600',
  failed: 'text-red-600',
  running: 'text-blue-600',
  paused: 'text-amber-600',
};

const execStatusIcons: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  failed: XCircle,
  running: Play,
  paused: Pause,
};

const stepStatusColors: Record<string, string> = {
  completed: 'bg-emerald-500 text-white',
  failed: 'bg-red-500 text-white',
  pending: 'bg-muted text-muted-foreground',
  skipped: 'bg-neutral-300 text-neutral-500',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: workflow, isLoading, error } = useWorkflow(id!);
  const toggleStatus = useToggleWorkflowStatus();
  const executeWf = useExecuteWorkflow();

  if (isLoading) {
    return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>Workflow not found</p>
        <Link to="/workflows"><Button variant="outline"><ArrowLeft className="size-4 mr-2" />Back</Button></Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/workflows"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <div className="flex-1">
          <PageHeader title={workflow.name} description={workflow.schedule || workflow.type}>
            <div className="flex items-center gap-2">
              <Badge className={`capitalize ${statusColors[workflow.status] || ''}`}>{workflow.status}</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const result = await toggleStatus.mutateAsync(id!);
                    toast.success(`Workflow ${result.status === 'active' ? 'activated' : 'paused'}`);
                  } catch { toast.error('Failed to toggle status'); }
                }}
                disabled={toggleStatus.isPending}
              >
                {toggleStatus.isPending ? <Loader2 className="size-4 animate-spin" /> : workflow.status === 'active' ? <Pause className="size-4" /> : <Play className="size-4" />}
                {workflow.status === 'active' ? 'Pause' : 'Activate'}
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const exec = await executeWf.mutateAsync(id!);
                    toast.success(`Executed — ${exec.result}`);
                  } catch { toast.error('Execution failed'); }
                }}
                disabled={executeWf.isPending}
              >
                {executeWf.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Run Now
              </Button>
            </div>
          </PageHeader>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{workflow.description}</p>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{workflow.totalRuns}</p><p className="text-sm text-muted-foreground">Total Runs</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-emerald-600">{workflow.successRate}%</p><p className="text-sm text-muted-foreground">Success Rate</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-sm font-medium">{workflow.lastRunAt ? formatDate(workflow.lastRunAt) : '—'}</p><p className="text-sm text-muted-foreground">Last Run</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-sm font-medium">{workflow.nextRunAt ? formatDate(workflow.nextRunAt) : '—'}</p><p className="text-sm text-muted-foreground">Next Run</p></CardContent></Card>
      </div>

      {/* Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow Steps</CardTitle>
          <CardDescription>{workflow.steps.length} steps in sequence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {workflow.steps.map((step, i) => (
              <div key={step.id}>
                <div className="flex items-start gap-3">
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${stepStatusColors[step.status] || stepStatusColors.pending}`}>
                    {step.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{step.name}</p>
                      <Badge variant="secondary" className="text-[10px]">{step.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.config}</p>
                  </div>
                </div>
                {i < workflow.steps.length - 1 && (
                  <div className="ml-4 flex items-center py-1">
                    <div className="h-4 w-px bg-border" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execution History</CardTitle>
          <CardDescription>Recent workflow runs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {workflow.recentExecutions.map((exec) => {
              const StatusIcon = execStatusIcons[exec.status] || Clock;
              return (
                <div key={exec.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`size-5 ${execStatusColors[exec.status] || ''}`} />
                    <div>
                      <p className="text-sm font-medium">{formatDate(exec.startedAt)}</p>
                      <p className="text-xs text-muted-foreground">{exec.result || `${exec.stepsCompleted}/${exec.stepsTotal} steps`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{exec.stepsCompleted}/{exec.stepsTotal}</Badge>
                    <Badge className={`text-xs capitalize ${exec.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : exec.status === 'failed' ? 'bg-red-500/10 text-red-600' : 'bg-blue-500/10 text-blue-600'}`}>
                      {exec.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
