import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
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
import { useDebounce } from '@/lib/hooks/use-debounce';
import { FilterSelect } from '@/components/ui/filter-select';

import { logError } from '../../lib/log';
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

const BUCKET_TABS = ['all', 'uncategorized', 'fixed', 'one_off', 'advertising'] as const;
type BucketTab = (typeof BUCKET_TABS)[number];

const bucketLabels: Record<BucketTab, string> = {
  all: 'All',
  uncategorized: 'Uncategorised',
  fixed: 'Fixed costs',
  one_off: 'One-off',
  advertising: 'Advertising',
};

// Short bucket suffix shown in the category dropdowns (distinct from the
// tab labels above). Shared by both the page filter and the per-row select.
const bucketShort = (b: string) => (b === 'fixed' ? 'fixed' : b === 'one_off' ? 'one-off' : 'advertising');
const categoryOptions = (categories: CostCategory[]) =>
  categories.map((c) => ({ value: c.id, label: `${c.name} (${bucketShort(c.bucket)})` }));

export function BankFeedPage() {
  const [bucket, setBucket] = useState<BucketTab>('uncategorized');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useBankTransactions({
    // A per-category filter is more specific than the bucket tabs, so when
    // it's set we ignore both `uncategorized` and `bucket` (otherwise picking
    // a category from a different bucket would yield an empty list).
    uncategorized: categoryFilter ? undefined : bucket === 'uncategorized' ? true : undefined,
    bucket: categoryFilter
      ? undefined
      : bucket === 'fixed' || bucket === 'one_off' || bucket === 'advertising'
        ? bucket
        : undefined,
    categoryId: categoryFilter || undefined,
    search: debouncedSearch || undefined,
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
      logError('Bank-feed sync failed', err);
      toast.error(err instanceof Error ? err.message : 'Sync failed — is Xero connected?');
    }
  }

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Bank Feed</h1>
          <p className="ahead-sub">
            {syncStatus?.lastSyncAt
              ? `Categorise costs from your Xero bank feed · last synced ${formatRelativeTime(syncStatus.lastSyncAt)}`
              : 'Categorise costs from your Xero bank feed · auto-syncs hourly'}
          </p>
        </div>
        <div className="page-actions">
          <CategoryDialog />
          <button className="btn b-dark b-sm" onClick={handleSync} disabled={sync.isPending}>
            {sync.isPending
              ? <Loader2 className="size-[15px] animate-spin" />
              : <RefreshCw className="size-[15px]" />}
            Sync from Xero
          </button>
        </div>
      </div>

      {/* Bucket tabs — own row so they're never squeezed by the
          filter + search controls (Sam screenshot 2026-05-14). */}
      <div className="bf-tabs">
        {BUCKET_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setBucket(tab); setCategoryFilter(''); setPage(1); }}
            className={'bf-tab' + (bucket === tab && !categoryFilter ? ' on' : '')}
          >
            {bucketLabels[tab]}
          </button>
        ))}
      </div>

      {/* Category filter + search */}
      <div className="bf-filters">
        <span className="bf-filter-lab">Filter by category</span>
        <FilterSelect
          ariaLabel="Filter by category"
          value={categoryFilter}
          style={{ minWidth: 220 }}
          onChange={(v) => {
            // A specific category overrides the bucket tabs — reset bucket
            // back to "all" so users don't see an empty list from a
            // bucket+category mismatch.
            setCategoryFilter(v);
            if (v) setBucket('all');
            setPage(1);
          }}
          options={[{ value: '', label: 'All categories' }, ...categoryOptions(categories ?? [])]}
        />
        <div className="inv-search">
          <span className="lic"><Search className="size-4" /></span>
          <input
            placeholder="Search vendor or description…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="card acard inv-card">
        {isLoading && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}

        {!isLoading && error && (
          <div className="inv-empty">
            <AlertTriangle className="size-5" style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
            Couldn't load transactions — something went wrong reaching the server. Try refreshing the page.
          </div>
        )}

        {!isLoading && !error && data?.transactions.length === 0 && (
          <div className="inv-empty">
            <Banknote className="size-5" style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
            {search || bucket !== 'all'
              ? 'No transactions match your filters.'
              : 'No transactions yet — click "Sync from Xero" to pull in the last 90 days of bank-feed transactions.'}
          </div>
        )}

        {!isLoading && !error && data && data.transactions.length > 0 && (
          <table className="inv-table bf-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vendor / Description</th>
                <th className="r">Amount</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} categories={categories ?? []} />
              ))}
            </tbody>
          </table>
        )}

        {data && data.total > 0 && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </div>
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
      logError('Categorise failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update category');
    }
  }

  return (
    <>
      <tr>
        <td className="inv-date">{formatDate(tx.date)}</td>
        <td style={{ maxWidth: 320 }}>
          <div className="bf-vendor">{tx.vendorName ?? '(no vendor)'}</div>
          {tx.description && <div className="bf-desc">{tx.description}</div>}
        </td>
        <td className={'r mono bf-amt ' + (isOut ? 'neg' : 'pos')}>
          {formatCurrency(amountNum, tx.currency)}
        </td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilterSelect
              ariaLabel="Category"
              value={tx.categoryId ?? ''}
              muted={!tx.categoryId}
              disabled={categorize.isPending}
              style={{ width: '100%', maxWidth: 240 }}
              onChange={(next) => {
                if (next === '') {
                  // Uncategorise: skip the confirm dialog (no rule-learning
                  // decision needed) — the old code routed this through the
                  // dialog which never opened because its open prop was
                  // pendingCategoryId !== null, silently dropping the action.
                  void applyCategory(null, false, false);
                  return;
                }
                setPendingCategoryId(next);
              }}
              options={[{ value: '', label: '— Uncategorised —' }, ...categoryOptions(categories)]}
            />
            {tx.isAutoCategorized && (
              <span className="pill p-soft" title="Auto-tagged by a vendor rule">
                <Sparkles className="size-3" /> auto
              </span>
            )}
          </div>
        </td>
      </tr>

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
            <p className="text-xs" style={{ color: 'var(--fg2)' }}>
              You can also remember this so future transactions from the same vendor are tagged automatically.
            </p>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <button
              className="btn b-ghost b-sm"
              onClick={() => applyCategory(pendingCategoryId, false, false)}
              disabled={categorize.isPending}
            >
              Just this one
            </button>
            <button
              className="btn b-ghost b-sm"
              onClick={() => applyCategory(pendingCategoryId, true, false)}
              disabled={categorize.isPending}
            >
              Remember vendor
            </button>
            <button
              className="btn b-dark b-sm"
              onClick={() => applyCategory(pendingCategoryId, true, true)}
              disabled={categorize.isPending}
            >
              {categorize.isPending && <Loader2 className="size-4 animate-spin" />}
              Remember + apply to past
            </button>
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
  const [bucket, setBucket] = useState<'fixed' | 'one_off' | 'advertising'>('fixed');
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
      logError('Create category failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add category');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="btn b-ghost b-sm">
          <Plus className="size-[15px]" /> New category
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add cost category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="nc-field">
            <label className="nc-label" htmlFor="cat-name">Name</label>
            <input
              id="cat-name"
              className="nc-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wages, Software, Travel"
            />
          </div>
          <div className="nc-field">
            <label className="nc-label">Bucket</label>
            <FilterSelect
              ariaLabel="Bucket"
              value={bucket}
              onChange={(v) => {
                if (v === 'fixed' || v === 'one_off' || v === 'advertising') setBucket(v);
              }}
              options={[
                { value: 'fixed', label: 'Fixed cost (recurring)' },
                { value: 'one_off', label: 'One-off' },
                { value: 'advertising', label: 'Advertising (Facebook, Google, etc.)' },
              ]}
            />
            <p className="text-xs" style={{ color: 'var(--fg2)' }}>
              Fixed = recurring (rent, salaries, software). One-off = ad-hoc (flights, equipment).
              Advertising = ad-platform spend (kept separate from fixed/one-off for clean P&amp;L).
            </p>
          </div>
        </div>
        <DialogFooter>
          <button className="btn b-ghost b-sm" onClick={() => setOpen(false)} disabled={create.isPending}>
            Cancel
          </button>
          <button className="btn b-dark b-sm" onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Add category
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
