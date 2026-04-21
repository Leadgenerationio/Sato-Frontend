import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortalLeads } from '@/lib/hooks/use-portal';

export function PortalLeadsPage() {
  const { data: leads, isLoading } = usePortalLeads();

  if (isLoading || !leads) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /><Skeleton className="h-96" /></div>;
  }

  const chartData = leads.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    leads: d.leadCount,
  }));

  const totalLeads = leads.reduce((sum, d) => sum + d.leadCount, 0);
  const avgPerDay = leads.length > 0 ? Math.round(totalLeads / leads.length) : 0;
  const peakDay = leads.reduce((max, d) => (d.leadCount > max.leadCount ? d : max), leads[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lead Deliveries</h1>
        <p className="text-muted-foreground">Daily lead delivery breakdown — last 30 days</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{totalLeads}</p><p className="text-sm text-muted-foreground">Total Leads</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{avgPerDay}</p><p className="text-sm text-muted-foreground">Avg / Day</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{peakDay?.leadCount ?? 0}</p><p className="text-sm text-muted-foreground">Peak Day</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Daily Volume</CardTitle><CardDescription>Leads delivered per day</CardDescription></CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip />
                <Area type="monotone" dataKey="leads" stroke="#171717" fill="#171717" fillOpacity={0.15} name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Daily Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...leads].reverse().map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</TableCell>
                    <TableCell className="text-muted-foreground">{d.campaignName}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{d.leadCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
