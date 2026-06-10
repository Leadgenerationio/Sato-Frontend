import { useParams, Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Pause, Play, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWorkflow, useToggleWorkflowStatus, useExecuteWorkflow } from '@/lib/hooks/use-workflows';

import { logError } from '../../lib/log';

const statusPill: Record<string, string> = {
  active: 'pos',
  paused: 'wfpause',
  draft: 'gray',
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

const execStatusPill: Record<string, string> = {
  completed: 'pos',
  failed: 'neg',
  running: 'infosoft',
  paused: 'wfpause',
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
    return <div className="screen-page"><Skeleton className="h-8 w-64" /><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;
  }

  if (error || !workflow) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>Workflow not found</p>
        <Link to="/workflows"><button type="button" className="btn b-ghost b-sm"><ArrowLeft className="size-4" />Back</button></Link>
      </div>
    );
  }

  const stats = [
    { v: String(workflow.totalRuns), l: 'Total Runs', green: false },
    { v: `${workflow.successRate}%`, l: 'Success Rate', green: true },
    { v: workflow.lastRunAt ? formatDate(workflow.lastRunAt) : '—', l: 'Last Run', green: false },
    { v: workflow.nextRunAt ? formatDate(workflow.nextRunAt) : '—', l: 'Next Run', green: false },
  ];

  return (
    <div className="screen-page">
      <div className="page-head wf-detail-head">
        <div className="nc-title-row">
          <Link to="/workflows" className="nc-back" title="Back to workflows"><ArrowLeft className="size-5" /></Link>
          <div>
            <h1 className="ahead-title">{workflow.name}</h1>
            <p className="ahead-sub">{workflow.schedule || workflow.type}</p>
          </div>
        </div>
        <div className="wf-detail-actions">
          <span className={'pill p-' + (statusPill[workflow.status] || 'gray')} style={{ textTransform: 'capitalize' }}>{workflow.status}</span>
          <button
            type="button"
            className="btn b-ghost b-sm"
            onClick={async () => {
              try {
                const result = await toggleStatus.mutateAsync(id!);
                toast.success(`Workflow ${result.status === 'active' ? 'activated' : 'paused'}`);
              } catch (err) { logError('Operation failed', err); toast.error('Failed to toggle status'); }
            }}
            disabled={toggleStatus.isPending}
          >
            {toggleStatus.isPending ? <Loader2 className="size-[15px] animate-spin" /> : workflow.status === 'active' ? <Pause className="size-[15px]" /> : <Play className="size-[15px]" />}
            {workflow.status === 'active' ? 'Pause' : 'Activate'}
          </button>
          <button
            type="button"
            className="btn b-dark b-sm"
            onClick={async () => {
              try {
                const exec = await executeWf.mutateAsync(id!);
                toast.success(`Executed — ${exec.result}`);
              } catch (err) { logError('Operation failed', err); toast.error('Execution failed'); }
            }}
            disabled={executeWf.isPending}
          >
            {executeWf.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <Play className="size-[15px]" />}
            Run Now
          </button>
        </div>
      </div>

      <p className="wf-detail-desc">{workflow.description}</p>

      {/* Stats */}
      <div className="wf-stat-row">
        {stats.map((s, i) => (
          <div key={i} className="wf-stat" style={{ borderRadius: 16 }}>
            <div className={'wf-stat-v' + (s.green ? ' green' : '')}>{s.v}</div>
            <div className="wf-stat-l">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="card pad acard">
        <h3 className="statto-title">Workflow Steps</h3>
        <p className="ac-sub" style={{ marginTop: 4, marginBottom: 16 }}>{workflow.steps.length} steps in sequence</p>
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
                    <span className="pill p-gray">{step.type}</span>
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
      </div>

      {/* Execution History */}
      <div className="card pad acard">
        <h3 className="statto-title">Execution History</h3>
        <p className="ac-sub" style={{ marginTop: 4, marginBottom: 16 }}>Recent workflow runs</p>
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
                  <span className="pill p-gray">{exec.stepsCompleted}/{exec.stepsTotal}</span>
                  <span className={'pill p-' + (execStatusPill[exec.status] || 'infosoft')} style={{ textTransform: 'capitalize' }}>
                    {exec.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
