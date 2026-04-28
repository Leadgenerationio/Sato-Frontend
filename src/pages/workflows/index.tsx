import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Clock, CheckCircle2, Pause, Workflow, Plus } from 'lucide-react';
import { useWorkflows } from '@/lib/hooks/use-workflows';
import { EmptyState } from '@/components/shared/empty-state';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
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
                    <Link to={`/workflows/${wf.id}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="size-4 mr-1.5" />
                        View
                      </Button>
                    </Link>
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
