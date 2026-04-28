import { useState } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { Banknote, RefreshCw, Plus, Loader2, Search, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  useBankTransactions,
  useCostCategories,
  useCreateCategory,
  useCategorizeTransaction,
  useSyncBankFeed,
  useBankFeedSyncStatus,
  toMoney,
  type BankTransaction,
  type CostCategory,
} from '@/lib/hooks/use-bank-feed';

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const BUCKET_TABS = ['all', 'uncategorized', 'fixed', 'one_off'] as const;
type BucketTab = (typeof BUCKET_TABS)[number];

const bucketLabels: Record<BucketTab, string> = {
  all: 'All',
  uncategorized: 'Uncategorised',
  fixed: 'Fixed costs',
  one_off: 'One-off',
};

export function BankFeedPage() {
  const [bucket, setBucket] = useState<BucketTab>('uncategorized');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useBankTransactions({
    uncategorized: bucket === 'uncategorized' ? true : undefined,
    bucket: bucket === 'fixed' || bucket === 'one_off' ? bucket : undefined,
    search: search || undefined,
    page,
    limit: 25,
  });

  const { data: categories } = useCostCategories();
  const sync = useSyncBankFeed();
  const { data: syncStatus } = useBankFeedSyncStatus();

  async function handleSync() {
    try {
      const result = await sync.mutateAsync({});
      toast.success(`Sync complete — ${result.inserted} new, ${result.autoCategorized} auto-categorised`);
    } catch (err) {
      console.error('Bank-feed sync failed', err);
      toast.error(err instanceof Error ? err.message : 'Sync failed — is Xero connected?');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bank Feed"
        description={
          syncStatus?.lastSyncAt
            ? `Categorise costs from your Xero bank feed · last synced ${formatRelativeTime(syncStatus.lastSyncAt)}`
            : 'Categorise costs from your Xero bank feed · auto-syncs hourly'
        }
      >
        <CategoryDialog />
        <Button size="sm" onClick={handleSync} disabled={sync.isPending}>
          {sync.isPending
            ? <Loader2 className="size-4 animate-spin" />
            : <RefreshCw className="size-4" />}
          Sync from Xero
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {BUCKET_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setBucket(tab); setPage(1); }}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                bucket === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {bucketLabels[tab]}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search vendor or description..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-2 p-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {!isLoading && error && (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load transactions"
              description="Something went wrong reaching the server. Try refreshing the page."
            />
          )}

          {!isLoading && !error && data?.transactions.length === 0 && (
            <EmptyState
              icon={Banknote}
              title={search || bucket !== 'all' ? 'No matching transactions' : 'No transactions yet'}
              description={
                search || bucket !== 'all'
                  ? 'Try a different search or tab.'
                  : 'Click "Sync from Xero" to pull in the last 90 days of bank-feed transactions.'
              }
            />
          )}

          {!isLoading && !error && data && data.transactions.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor / Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} categories={categories ?? []} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {data && data.total > 0 && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Row with categorise dropdown ────────────────────────────────────────────

function TransactionRow({ tx, categories }: { tx: BankTransaction; categories: CostCategory[] }) {
  const categorize = useCategorizeTransaction();
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);

  const amountNum = toMoney(tx.amount);
  const isOut = amountNum < 0;

  async function applyCategory(categoryId: string | null, learnRule: boolean, applyRetroactively: boolean) {
    try {
      await categorize.mutateAsync({
        transactionId: tx.id,
        categoryId,
        learnRule,
        applyRetroactively,
      });
      toast.success('Category updated');
      setPendingCategoryId(null);
    } catch (err) {
      console.error('Categorise failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update category');
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
          {formatDate(tx.date)}
        </TableCell>
        <TableCell className="max-w-[180px] sm:max-w-[320px]">
          <p className="truncate text-sm font-medium">{tx.vendorName ?? '(no vendor)'}</p>
          {tx.description && (
            <p className="truncate text-xs text-muted-foreground">{tx.description}</p>
          )}
        </TableCell>
        <TableCell className={`whitespace-nowrap text-right text-sm font-medium tabular-nums ${isOut ? 'text-red-600' : 'text-emerald-600'}`}>
          {formatCurrency(amountNum, tx.currency)}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <select
              value={tx.categoryId ?? ''}
              onChange={(e) => setPendingCategoryId(e.target.value || null)}
              disabled={categorize.isPending}
              className="flex h-8 w-full max-w-[200px] rounded-md border border-input bg-transparent px-2 text-sm shadow-sm"
            >
              <option value="">— Uncategorised —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.bucket === 'fixed' ? 'fixed' : 'one-off'})</option>
              ))}
            </select>
            {tx.isAutoCategorized && (
              <Badge variant="secondary" className="text-[10px]" title="Auto-tagged by a vendor rule">
                <Sparkles className="size-3" /> auto
              </Badge>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Confirmation dialog for changes */}
      <Dialog open={pendingCategoryId !== null} onOpenChange={(open) => !open && setPendingCategoryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply category?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Set <strong>{tx.vendorName ?? '(no vendor)'}</strong> to{' '}
              <strong>{categories.find((c) => c.id === pendingCategoryId)?.name ?? 'Uncategorised'}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              You can also remember this so future transactions from the same vendor are tagged automatically.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => applyCategory(pendingCategoryId, false, false)}
              disabled={categorize.isPending}
            >
              Just this one
            </Button>
            <Button
              variant="outline"
              onClick={() => applyCategory(pendingCategoryId, true, false)}
              disabled={categorize.isPending}
            >
              Remember vendor
            </Button>
            <Button
              onClick={() => applyCategory(pendingCategoryId, true, true)}
              disabled={categorize.isPending}
            >
              {categorize.isPending && <Loader2 className="size-4 animate-spin" />}
              Remember + apply to past
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Add-category dialog ─────────────────────────────────────────────────────

function CategoryDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [bucket, setBucket] = useState<'fixed' | 'one_off'>('fixed');
  const create = useCreateCategory();

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), bucket });
      toast.success(`Category "${name}" added`);
      setName('');
      setBucket('fixed');
      setOpen(false);
    } catch (err) {
      console.error('Create category failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add category');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          New category
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add cost category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wages, Software, Travel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-bucket">Bucket</Label>
            <select
              id="cat-bucket"
              value={bucket}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'fixed' || v === 'one_off') setBucket(v);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="fixed">Fixed cost (recurring)</option>
              <option value="one_off">One-off</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Fixed = recurring (rent, salaries, software). One-off = ad-hoc (flights, equipment).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Add category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
