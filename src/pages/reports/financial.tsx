import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useFinancialReport, type FinancialOverviewRow } from '@/lib/hooks/use-reports';

function fmt(v: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v); }

function exportCsv(data: FinancialOverviewRow[]) {
  const h = 'Month,Revenue,Expenses,Profit,Invoices Paid,Invoices Overdue,VAT Collected\n';
  const rows = data.map((r) => `${r.month},${r.revenue},${r.expenses},${r.profit},${r.invoicesPaid},${r.invoicesOverdue},${r.vatCollected}`).join('\n');
  const blob = new Blob([h + rows], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'financial-overview.csv'; a.click();
}

export function FinancialReportPage() {
  const { data, isLoading } = useFinancialReport();

  if (isLoading || !data) return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-80" /></div>;

  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = data.reduce((s, r) => s + r.profit, 0);
  const totalVat = data.reduce((s, r) => s + r.vatCollected, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Financial Overview" description="Revenue, expenses, and profit over 12 months">
          <Button variant="outline" size="sm" onClick={() => exportCsv(data)}><Download className="size-4 mr-1.5" />CSV</Button>
        </PageHeader>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{fmt(totalRevenue)}</p><p className="text-sm text-muted-foreground">Annual Revenue</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold text-emerald-600">{fmt(totalProfit)}</p><p className="text-sm text-muted-foreground">Annual Profit</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{fmt(totalVat)}</p><p className="text-sm text-muted-foreground">VAT Collected</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue vs Expenses</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [fmt(Number(v)), '']} />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="#171717" fill="#171717" fillOpacity={0.1} name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#a3a3a3" fill="#a3a3a3" fillOpacity={0.1} name="Expenses" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">VAT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.month}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.expenses)}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600">{fmt(r.profit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.invoicesPaid}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.invoicesOverdue > 0 ? <span className="text-red-600">{r.invoicesOverdue}</span> : '0'}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.vatCollected)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
