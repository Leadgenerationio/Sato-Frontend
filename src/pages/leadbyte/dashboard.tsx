import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LbWindowSelector } from '@/components/shared/lb-window-selector';
import {
  useLbSummary,
  useLbCampaignReport,
  useLbSupplierSpend,
  useLbManualSync,
  LB_WINDOW_LABELS,
  type LbWindow,
} from '@/lib/hooks/use-leadbyte';

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'never';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function formatMoney(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-GB').format(value || 0);
}

function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <Card className="gap-1 overflow-hidden py-4">
      <CardContent className="px-4">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 truncate text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
        {subValue && <p className="mt-1 truncate text-xs text-muted-foreground">{subValue}</p>}
      </CardContent>
    </Card>
  );
}

export function LeadByteDashboardPage() {
  const [window, setWindow] = useState<LbWindow>('today');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, forceRender] = useState(0);

  const summary = useLbSummary(window);
  const campaigns = useLbCampaignReport(window);
  const suppliers = useLbSupplierSpend(window);
  const manualSync = useLbManualSync();

  const totals = summary.data;
  const currency = totals?.currency || 'GBP';

  useEffect(() => {
    if (summary.dataUpdatedAt) setLastUpdated(new Date(summary.dataUpdatedAt));
  }, [summary.dataUpdatedAt]);

  useEffect(() => {
    const t = setInterval(() => forceRender((n) => n + 1), 5_000);
    return () => clearInterval(t);
  }, []);

  async function handleRefreshNow() {
    try {
      await manualSync.mutateAsync();
      toast.success('Sync queued — refreshing data in a moment');
    } catch {
      toast.error('Failed to queue sync');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="LeadByte Dashboard"
        description="Live + historical breakdowns by campaign and supplier"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground" data-testid="lb-window-label">
          Showing: <span className="text-foreground">{LB_WINDOW_LABELS[window]}</span>
          <span className="ml-3 text-xs">Updated {formatRelativeTime(lastUpdated)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshNow}
            disabled={manualSync.isPending}
          >
            <RefreshCw className={`size-4 mr-1.5 ${manualSync.isPending ? 'animate-spin' : ''}`} />
            {manualSync.isPending ? 'Syncing…' : 'Refresh now'}
          </Button>
          <LbWindowSelector value={window} onChange={setWindow} />
        </div>
      </div>

      {/* Top-line stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summary.isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-[96px] w-full" />)
        ) : (
          <>
            <StatCard label="Leads" value={formatNumber(totals?.leads ?? 0)} subValue={`${totals?.campaigns ?? 0} campaigns`} />
            <StatCard label="Valid" value={formatNumber(totals?.valid ?? 0)} />
            <StatCard label="Revenue" value={formatMoney(totals?.revenue ?? 0, currency)} />
            <StatCard label="Payout" value={formatMoney(totals?.payout ?? 0, currency)} />
            <StatCard label="Profit" value={formatMoney(totals?.profit ?? 0, currency)} />
          </>
        )}
      </div>

      {/* Campaigns table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaigns — {LB_WINDOW_LABELS[window]}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.isLoading && (
            <div className="p-6 space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          )}
          {campaigns.isError && (
            <div className="p-6 text-sm text-red-600">Failed to load campaign report.</div>
          )}
          {campaigns.data && campaigns.data.length === 0 && !campaigns.isLoading && (
            <div className="p-6 text-sm text-muted-foreground">No campaign activity in this window.</div>
          )}
          {campaigns.data && campaigns.data.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Valid</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Payout</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.data.map((row, idx) => (
                    <TableRow key={`${row.campaign}-${idx}`}>
                      <TableCell className="font-medium">{row.campaign}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.leads)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.valid)}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{formatMoney(row.revenue, row.currency || currency)}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{formatMoney(row.payout, row.currency || currency)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">{formatMoney(row.profit, row.currency || currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier spend table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supplier Spend — {LB_WINDOW_LABELS[window]}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {suppliers.isLoading && (
            <div className="p-6 space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          )}
          {suppliers.data && suppliers.data.length === 0 && !suppliers.isLoading && (
            <div className="p-6 text-sm text-muted-foreground">No supplier activity in this window.</div>
          )}
          {suppliers.data && suppliers.data.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.data.map((row) => (
                    <TableRow key={row.supplierId}>
                      <TableCell className="font-medium">{row.supplierName}</TableCell>
                      <TableCell className="text-muted-foreground">{row.campaignName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.leads)}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{formatMoney(row.spend, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{formatMoney(row.cpl, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
