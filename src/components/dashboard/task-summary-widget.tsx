import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckSquare, Clock, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useTaskStats } from '@/lib/hooks/use-tasks';

export function TaskSummaryWidget() {
  const { data: stats, isLoading } = useTaskStats();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const items = [
    { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-500/10' },
    { label: 'Completed Today', value: stats.completedToday, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-500/10' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Tasks</CardTitle>
            <CardDescription>{stats.total} total</CardDescription>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <CheckSquare className="size-5 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`flex size-7 items-center justify-center rounded-md ${item.bg}`}>
                <item.icon className={`size-3.5 ${item.color}`} />
              </div>
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
            <span className={`text-sm font-bold tabular-nums ${item.value > 0 && item.label === 'Overdue' ? 'text-red-600' : ''}`}>
              {item.value}
            </span>
          </div>
        ))}

        <Link to="/tasks">
          <Button variant="outline" size="sm" className="w-full mt-1">
            <ExternalLink className="size-4 mr-1.5" />
            View All Tasks
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
