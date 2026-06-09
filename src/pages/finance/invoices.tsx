import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ExternalLink, Plus, Download, FileText, ArrowUp, ArrowDown, ArrowUpDown, Calendar } from 'lucide-react';
import { useInvoices, toMoney, type InvoiceSummary, type InvoiceSortBy, type SortDir } from '@/lib/hooks/use-invoices';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';

const STATUS_TABS = ['all', 'draft', 'sent', 'authorised', 'paid', 'overdue'] as const;

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  sent: 'bg-info-bg text-info border-info/30',
  authorised: 'bg-info-bg text-info border-info/30',
  paid: 'bg-positive-bg text-positive border-positive/30',
  overdue: 'bg-negative-bg text-negative border-negative/30',
};

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function exportCsv(invoices: InvoiceSummary[]) {
  // Quote + escape every field — client names routinely contain commas
  // ("Acme, Inc.") which would otherwise shift columns and corrupt the CSV.
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = 'Invoice,Client,Status,Currency,Subtotal,VAT,Total,Due Date,Created\n';
  const rows = invoices.map((inv) =>
    [inv.invoiceNumber, inv.clientName, inv.status, inv.currency, inv.subtotal, inv.vatAmount, inv.total, formatDate(inv.dueDate), formatDate(inv.createdAt)]
      .map(q)
      .join(','),
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SortableHead({
  id, label, align = 'left', sortBy, sortDir, onToggle,
}: {
  id: InvoiceSortBy;
  label: string;
  align?: 'left' | 'right';
  sortBy: InvoiceSortBy | undefined;
  sortDir: SortDir;
  onToggle: (id: InvoiceSortBy) => void;
}) {
  const active = sortBy === id;
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={align === 'right' ? 'text-right' : ''}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={`inline-flex items-center gap-1 transition-colors ${active ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
      >
        {label}
        <Icon className="size-3" />
      </button>
    </TableHead>
  );
}

export function InvoiceListPage() {
  // URL-sync filter state so refresh / share-link preserves the view (Sam #7).
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') ?? 'all';
  const search = searchParams.get('search') ?? '';
  const sortBy = (searchParams.get('sortBy') as InvoiceSortBy | null) ?? 'createdAt';
  const sortDir = (searchParams.get('sortDir') as SortDir | null) ?? 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const [searchDraft, setSearchDraft] = useState(search);
  const debouncedSearch = useDebounce(searchDraft, 300);

  // Push debounced search into the URL when it changes. setSearchParams must
  // run inside an effect (not directly in render) to avoid the React "update
  // during render" warning.
  useEffect(() => {
    if (debouncedSearch === search) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedSearch) next.set('search', debouncedSearch);
      else next.delete('search');
      next.delete('page');
      return next;
    }, { replace: true });
  }, [debouncedSearch, search, setSearchParams]);

  function patchSearch(updates: Record<string, string | null>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      return next;
    });
  }

  const { data, isLoading, error, refetch } = useInvoices({
    status: statusFilter,
    search: debouncedSearch,
    page,
    limit: 10,
    sortBy,
    sortDir,
  });
  const invoices = data?.invoices;

  const handleStatusChange = (s: string) => patchSearch({ status: s === 'all' ? null : s, page: null });
  const handlePageChange = (p: number) => patchSearch({ page: String(p) });
  const handleSort = (col: InvoiceSortBy) => {
    if (sortBy === col) {
      patchSearch({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      patchSearch({ sortBy: col, sortDir: 'desc' });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Invoices" description="Manage invoices synced with Xero">
        <div className="flex gap-2">
          <Link to="/finance/auto-invoice">
            <Button variant="outline" size="sm">
              <Calendar className="size-4 mr-1.5" />
              Auto-invoice
            </Button>
          </Link>
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
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
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
            <ErrorState
              title="Couldn't load invoices"
              error={error}
              onRetry={() => refetch()}
            />
          ) : !invoices?.length ? (
            <EmptyState
              icon={FileText}
              title={debouncedSearch || statusFilter !== 'all' ? 'No matching invoices' : 'No invoices yet'}
              description={
                debouncedSearch || statusFilter !== 'all'
                  ? 'Try a different search or status filter.'
                  : 'Create your first invoice to bill clients and push it through to Xero.'
              }
              link={debouncedSearch || statusFilter !== 'all' ? undefined : { label: 'New invoice', to: '/finance/invoices/create', icon: Plus }}
            />
          ) : (
            <div className="overflow-x-auto">
              {/* T3.6 (Sam, 2026-05-20): pin the Invoice column so the
                  identifier stays visible while the 9 metric columns
                  scroll horizontally on narrow viewports. */}
              <Table className="[&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:bg-card [&_th:first-child]:z-20 [&_th:first-child]:border-r [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:bg-card [&_td:first-child]:z-10 [&_td:first-child]:border-r">
                <TableHeader>
                  <TableRow>
                    <SortableHead id="invoiceNumber" label="Invoice" sortBy={sortBy} sortDir={sortDir} onToggle={handleSort} />
                    <TableHead>Client</TableHead>
                    <SortableHead id="status" label="Status" sortBy={sortBy} sortDir={sortDir} onToggle={handleSort} />
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <SortableHead id="total" label="Total" align="right" sortBy={sortBy} sortDir={sortDir} onToggle={handleSort} />
                    <SortableHead id="dueDate" label="Due Date" sortBy={sortBy} sortDir={sortDir} onToggle={handleSort} />
                    <SortableHead id="createdAt" label="Created" sortBy={sortBy} sortDir={sortDir} onToggle={handleSort} />
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
                            <Badge className="text-xs bg-info-bg text-info border-info/30">Xero</Badge>
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
            onPageChange={handlePageChange}
          />
        )}
      </Card>
    </div>
  );
}
