import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  useCampaignReport,
  WINDOW_OPTIONS,
  type CampaignReportRow,
  type DeliveryWindow,
} from '@/lib/hooks/use-reports';

function fmt(v: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v); }

function exportCsv(data: CampaignReportRow[]) {
  const h = 'Campaign,Client,Vertical,Leads,Valid,Revenue,Cost,CPL,Profit,Margin\n';
  const rows = data.map((r) => `${r.campaignName},${r.clientName},${r.vertical},${r.leads},${r.validLeads},${r.revenue},${r.cost},${r.cpl},${r.profit},${r.margin}%`).join('\n');
  const blob = new Blob([h + rows], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'campaign-report.csv'; a.click();
}

export function CampaignReportPage() {
  const [window, setWindow] = useState<DeliveryWindow>('this_month');
  const { data, isLoading } = useCampaignReport(window);

  if (isLoading || !data) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-80" /></div>;

  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = data.reduce((s, r) => s + r.profit, 0);
  const totalLeads = data.reduce((s, r) => s + r.leads, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Campaign Performance" description="Leads, revenue, cost, and profit by campaign">
          <Button variant="outline" size="sm" onClick={() => exportCsv(data)}><Download className="size-4 mr-1.5" />CSV</Button>
        </PageHeader>
      </div>

      <Tabs value={window} onValueChange={(v) => setWindow(v as DeliveryWindow)}>
        <TabsList className="flex-wrap gap-1">
          {WINDOW_OPTIONS.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value}>{opt.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{totalLeads.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Leads</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{fmt(totalRevenue)}</p><p className="text-sm text-muted-foreground">Total Revenue</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-emerald-600">{fmt(totalProfit)}</p><p className="text-sm text-muted-foreground">Total Profit</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue vs Cost by Campaign</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[350px]">
            {data.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data in this window</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="campaignName" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [fmt(v), '']} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#171717" name="Revenue" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="cost" fill="#a3a3a3" name="Cost" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Vertical</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.campaignId}>
                  <TableCell className="font-medium">{r.campaignName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.clientName}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{r.vertical}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.cost)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.cpl)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.profit)}</TableCell>
                  <TableCell className="text-right tabular-nums"><span className={r.margin >= 50 ? 'text-emerald-600' : r.margin >= 30 ? 'text-amber-600' : 'text-red-600'}>{r.margin}%</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
