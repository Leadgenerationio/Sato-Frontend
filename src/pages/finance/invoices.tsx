import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ExternalLink, Plus, Download, FileText } from 'lucide-react';
import { useInvoices, toMoney, type InvoiceSummary } from '@/lib/hooks/use-invoices';
import { Pagination } from '@/components/ui/pagination';

const STATUS_TABS = ['all', 'draft', 'sent', 'authorised', 'paid', 'overdue'] as const;

const statusColors: Record<string, string> = {
  draft: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
  sent: 'bg-blue-500/10 text-blue-600 border-blue-200',
  authorised: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  overdue: 'bg-red-500/10 text-red-600 border-red-200',
};

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function exportCsv(invoices: InvoiceSummary[]) {
  const header = 'Invoice,Client,Status,Currency,Subtotal,VAT,Total,Due Date,Created\n';
  const rows = invoices.map((inv) =>
    `${inv.invoiceNumber},${inv.clientName},${inv.status},${inv.currency},${inv.subtotal},${inv.vatAmount},${inv.total},${formatDate(inv.dueDate)},${formatDate(inv.createdAt)}`,
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function InvoiceListPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useInvoices({ status: statusFilter, search, page, limit: 10 });
  const invoices = data?.invoices;

  const handleStatusChange = (s: string) => { setStatusFilter(s); setPage(1); };
  const handleSearchChange = (val: string) => { setSearch(val); setPage(1); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Invoices" description="Manage invoices synced with Xero">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => invoices && exportCsv(invoices)} disabled={!invoices?.length}>
            <Download className="size-4 mr-1.5" />
            CSV
          </Button>
          <Link to="/finance/invoices/create">
            <Button size="sm">
              <Plus className="size-4 mr-1.5" />
              New Invoice
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleStatusChange(tab)}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <FileText className="size-8" />
              <p className="text-sm">Failed to load invoices</p>
            </div>
          ) : !invoices?.length ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <FileText className="size-8" />
              <p className="text-sm">No invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{inv.clientName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge className={`text-xs capitalize ${statusColors[inv.status] || ''}`}>
                            {inv.status}
                            {inv.daysOverdue > 0 && ` (${inv.daysOverdue}d)`}
                          </Badge>
                          {inv.xeroInvoiceId && (
                            <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-200">Xero</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(toMoney(inv.subtotal), inv.currency)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(toMoney(inv.vatAmount), inv.currency)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(toMoney(inv.total), inv.currency)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(inv.dueDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
                      <TableCell>
                        <Link to={`/finance/invoices/${inv.id}`}>
                          <Button variant="ghost" size="icon" className="size-8">
                            <ExternalLink className="size-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {data && data.total > 0 && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}
