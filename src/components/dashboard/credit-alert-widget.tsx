import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, TrendingDown, ExternalLink } from 'lucide-react';

interface CreditAlert {
  clientId: string;
  clientName: string;
  currentScore: number;
  scoreChange: number;
  reason: string;
}

const MOCK_ALERTS: CreditAlert[] = [
  { clientId: 'c-4', clientName: 'Delta Solutions', currentScore: 42, scoreChange: -23, reason: 'CCJ filed' },
  { clientId: 'c-8', clientName: 'Heritage Finance', currentScore: 38, scoreChange: -15, reason: 'Late payments' },
  { clientId: 'c-3', clientName: 'Clearwater Digital', currentScore: 55, scoreChange: -8, reason: 'Score decline' },
];

export function CreditAlertWidget() {
  const severeAlerts = MOCK_ALERTS.filter((a) => a.scoreChange <= -20);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Credit Alerts</CardTitle>
            <CardDescription>{MOCK_ALERTS.length} client{MOCK_ALERTS.length !== 1 ? 's' : ''} flagged</CardDescription>
          </div>
          <div className={`flex size-10 items-center justify-center rounded-lg ${severeAlerts.length > 0 ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
            <ShieldAlert className={`size-5 ${severeAlerts.length > 0 ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {MOCK_ALERTS.map((alert) => {
          const severe = alert.scoreChange <= -20;
          return (
            <Link key={alert.clientId} to={`/clients/${alert.clientId}`} className="block">
              <div className={`flex items-center justify-between rounded-lg border p-2.5 transition-colors hover:bg-muted/50 ${severe ? 'border-red-200' : ''}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{alert.clientName}</p>
                  <p className="text-xs text-muted-foreground">{alert.reason}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-sm font-bold tabular-nums ${alert.currentScore < 50 ? 'text-red-600' : 'text-amber-600'}`}>
                    {alert.currentScore}
                  </span>
                  <Badge className={`text-xs ${severe ? 'bg-red-500/10 text-red-600 border-red-200' : 'bg-amber-500/10 text-amber-600 border-amber-200'}`}>
                    <TrendingDown className="size-3 mr-0.5" />
                    {alert.scoreChange}
                  </Badge>
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
