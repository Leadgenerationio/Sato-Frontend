import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePortalCampaigns } from '@/lib/hooks/use-portal';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  inactive: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

export function PortalCampaignsPage() {
  const { data: campaigns, isLoading } = usePortalCampaigns();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <p className="text-muted-foreground">Your active lead generation campaigns</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Vertical</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">This Week</TableHead>
                  <TableHead className="text-right">This Month</TableHead>
                  <TableHead className="text-right">All Time</TableHead>
                  <TableHead>Start Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c.vertical}</Badge></TableCell>
                    <TableCell><Badge className={`text-xs capitalize ${statusColors[c.status] || ''}`}>{c.status}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{c.leadsThisWeek}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.leadsThisMonth}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{c.totalLeads.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
