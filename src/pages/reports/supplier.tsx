import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  useSupplierReport,
  WINDOW_OPTIONS,
  type SupplierReportRow,
  type DeliveryWindow,
} from '@/lib/hooks/use-reports';

function fmt(v: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v); }

function exportCsv(data: SupplierReportRow[]) {
  const h = 'Supplier,Platform,Spend,Leads,CPL,Campaigns\n';
  const rows = data.map((r) => `${r.supplierName},${r.platform},${r.totalSpend},${r.totalLeads},${r.cpl},${r.campaigns}`).join('\n');
  const blob = new Blob([h + rows], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'supplier-report.csv'; a.click();
}

export function SupplierReportPage() {
  const [window, setWindow] = useState<DeliveryWindow>('this_month');
  const { data, isLoading } = useSupplierReport(window);

  if (isLoading || !data) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-80" /></div>;

  const totalSpend = data.reduce((s, r) => s + r.totalSpend, 0);
  const totalLeads = data.reduce((s, r) => s + r.totalLeads, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Supplier Performance" description="Spend, volume, and CPL per traffic source">
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
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{fmt(totalSpend)}</p><p className="text-sm text-muted-foreground">Total Spend</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{totalLeads.toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Leads</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{fmt(totalLeads > 0 ? totalSpend / totalLeads : 0)}</p><p className="text-sm text-muted-foreground">Avg CPL</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>CPL by Supplier</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {data.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No spend in this window</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={(v) => `£${v}`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="supplierName" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [fmt(Number(v)), 'CPL']} />
                  <Bar dataKey="cpl" fill="#171717" radius={[0, 4, 4, 0]} name="CPL" />
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
                <TableHead>Supplier</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead className="text-right">Campaigns</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.supplierId}>
                  <TableCell className="font-medium">{r.supplierName}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{r.platform}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.totalSpend)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.totalLeads.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.cpl)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.campaigns}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
