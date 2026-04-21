import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import {
  useAdSpendList,
  useAdSpendSummary,
  useAdSpendStatus,
  useAdSpendSyncNow,
  AD_SPEND_PLATFORMS,
  defaultDateRange,
  formatMoney,
  type AdSpendRow,
} from '@/lib/hooks/use-ad-spend';

function exportCsv(rows: AdSpendRow[]) {
  const header = 'Date,Platform,Account,Campaign,Spend,Currency\n';
  const body = rows
    .map((r) =>
      [r.date, r.platform, r.accountName ?? '', (r.campaignName ?? '').replace(/[",]/g, ' '), r.spend, r.currency].join(','),
    )
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ad-spend.csv';
  a.click();
}

export function AdSpendReportPage() {
  const defaults = useMemo(defaultDateRange, []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [platform, setPlatform] = useState<string>('all');

  const filters = { from, to, platform };
  const { data: statusData } = useAdSpendStatus();
  const { data: summaryData, isLoading: summaryLoading } = useAdSpendSummary(filters);
  const { data: rowsData, isLoading: rowsLoading } = useAdSpendList(filters);
  const syncMutation = useAdSpendSyncNow();

  const total = summaryData?.total;
  const summary = summaryData?.rows ?? [];
  const rows = rowsData ?? [];

  const onSync = async () => {
    try {
      await syncMutation.mutateAsync();
      toast.success('Sync enqueued — data will refresh within a minute');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to enqueue sync');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Ad Spend" description="Per-platform campaign spend synced from Catchr">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onSync} disabled={syncMutation.isPending}>
              <RefreshCw className={`size-4 mr-1.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(rows)} disabled={rows.length === 0}>
              <Download className="size-4 mr-1.5" />CSV
            </Button>
          </div>
        </PageHeader>
      </div>

      {statusData && !statusData.configured && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-4 pb-4 text-sm text-amber-900">
            Catchr is not configured. Set <code className="px-1 rounded bg-amber-100">CATCHR_ACCESS_TOKEN</code> in the backend .env and restart the API.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          {statusData?.lastSyncAt && (
            <p className="ml-auto text-xs text-muted-foreground">
              Last sync: {new Date(statusData.lastSyncAt).toLocaleString('en-GB')}
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs value={platform} onValueChange={setPlatform}>
        <TabsList className="flex-wrap gap-1">
          {AD_SPEND_PLATFORMS.map((p) => (
            <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            {summaryLoading || !total ? <Skeleton className="h-8 w-32 mx-auto" /> : (
              <p className="text-2xl font-bold">{formatMoney(total.total, total.currency)}</p>
            )}
            <p className="text-sm text-muted-foreground">Total Spend</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            {summaryLoading || !total ? <Skeleton className="h-8 w-32 mx-auto" /> : (
              <p className="text-2xl font-bold">{total.rowCount.toLocaleString()}</p>
            )}
            <p className="text-sm text-muted-foreground">Rows (day × campaign)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            {summaryLoading ? <Skeleton className="h-8 w-32 mx-auto" /> : (
              <p className="text-2xl font-bold">{summary.length}</p>
            )}
            <p className="text-sm text-muted-foreground">Platform × Account</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Spend by Platform &amp; Account</CardTitle></CardHeader>
        <CardContent className="p-0">
          {summaryLoading ? (
            <div className="p-6"><Skeleton className="h-40 w-full" /></div>
          ) : summary.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No spend in this window</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Campaigns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((r, i) => (
                  <TableRow key={`${r.platform}-${r.accountName ?? 'unknown'}-${i}`}>
                    <TableCell><Badge variant="secondary" className="text-xs">{r.platform}</Badge></TableCell>
                    <TableCell className="font-medium">{r.accountName ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.totalSpend, r.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.campaigns}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Daily rows (top 500)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rowsLoading ? (
            <div className="p-6"><Skeleton className="h-80 w-full" /></div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No rows in this window</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums">{r.date}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{r.platform}</Badge></TableCell>
                    <TableCell>{r.accountName ?? '—'}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{r.campaignName ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(parseFloat(r.spend) || 0, r.currency)}
                    </TableCell>
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
