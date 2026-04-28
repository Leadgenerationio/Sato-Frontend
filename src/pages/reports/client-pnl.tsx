import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useClientPnlReport, type ClientPnlRow } from '@/lib/hooks/use-reports';

function fmt(v: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v); }

function exportCsv(data: ClientPnlRow[]) {
  const h = 'Client,Month,Revenue,Cost,Profit,Margin,Leads\n';
  const rows = data.map((r) => `${r.clientName},${r.month},${r.revenue},${r.cost},${r.profit},${r.margin}%,${r.leadsDelivered}`).join('\n');
  const blob = new Blob([h + rows], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'client-pnl.csv'; a.click();
}

export function ClientPnlReportPage() {
  const { data, isLoading } = useClientPnlReport();

  if (isLoading || !data) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-80" /></div>;

  // Aggregate by client for chart
  const clients = [...new Set(data.map((r) => r.clientName))];
  const months = [...new Set(data.map((r) => r.month))].sort();
  const chartData = months.map((m) => {
    const row: any = { month: new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) };
    clients.forEach((c) => {
      const entry = data.find((r) => r.clientName === c && r.month === m);
      row[c] = entry ? entry.profit : 0;
    });
    return row;
  });

  const colors = ['#171717', '#525252', '#a3a3a3', '#10b981', '#3b82f6'];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Client P&L" description="Monthly profit per client">
          <Button variant="outline" size="sm" onClick={() => exportCsv(data)}><Download className="size-4 mr-1.5" />CSV</Button>
        </PageHeader>
      </div>

      <Card>
        <CardHeader><CardTitle>Monthly Profit by Client</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [fmt(Number(v)), '']} />
                <Legend />
                {clients.map((c, i) => (
                  <Bar key={c} dataKey={c} fill={colors[i % colors.length]} stackId="a" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 max-h-[500px] overflow-y-auto">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.clientName}</TableCell>
                    <TableCell className="text-muted-foreground">{r.month}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.cost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.profit)}</TableCell>
                    <TableCell className="text-right tabular-nums"><span className={r.margin >= 50 ? 'text-emerald-600' : 'text-amber-600'}>{r.margin}%</span></TableCell>
                    <TableCell className="text-right tabular-nums">{r.leadsDelivered}</TableCell>
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
