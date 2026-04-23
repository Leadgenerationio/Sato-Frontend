import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, TrendingDown, ExternalLink } from 'lucide-react';
import { useCreditAlerts } from '@/lib/hooks/use-clients';

export function CreditAlertWidget() {
  const { data: alerts, isLoading } = useCreditAlerts();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-6 w-32" /></CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </CardContent>
      </Card>
    );
  }

  const list = alerts ?? [];
  const severeAlerts = list.filter((a) => a.scoreChange <= -20);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Credit Alerts</CardTitle>
            <CardDescription>
              {list.length} client{list.length !== 1 ? 's' : ''} flagged
            </CardDescription>
          </div>
          <div className={`flex size-10 items-center justify-center rounded-lg ${severeAlerts.length > 0 ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
            <ShieldAlert className={`size-5 ${severeAlerts.length > 0 ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No credit alerts — all clients above 55.</p>
        )}
        {list.map((alert) => {
          const severe = alert.scoreChange <= -20;
          return (
            <Link key={alert.clientId} to={`/clients/${alert.clientId}`} className="block">
              <div className={`flex items-center justify-between rounded-lg border p-2.5 transition-colors hover:bg-muted/50 ${severe ? 'border-red-200' : ''}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{alert.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.scoreChange < 0 ? `Score down ${Math.abs(alert.scoreChange)} pts` : 'Low credit score'}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-sm font-bold tabular-nums ${alert.currentScore < 50 ? 'text-red-600' : 'text-amber-600'}`}>
                    {alert.currentScore}
                  </span>
                  {alert.scoreChange < 0 && (
                    <Badge className={`text-xs ${severe ? 'bg-red-500/10 text-red-600 border-red-200' : 'bg-amber-500/10 text-amber-600 border-amber-200'}`}>
                      <TrendingDown className="size-3 mr-0.5" />
                      {alert.scoreChange}
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          );
        })}

        <Link to="/clients?status=all">
          <Button variant="outline" size="sm" className="w-full mt-1">
            <ExternalLink className="size-4 mr-1.5" />
            View All Clients
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
