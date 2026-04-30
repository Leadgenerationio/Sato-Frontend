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
import { Search, ExternalLink, Megaphone, AlertTriangle } from 'lucide-react';
import { useCampaigns, type CampaignSummary } from '@/lib/hooks/use-campaigns';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/shared/empty-state';

const STATUS_TABS = ['all', 'active', 'paused', 'inactive'] as const;
const TYPE_TABS = [
  { value: 'all', label: 'All Types' },
  { value: 'pay_per_lead', label: 'Pay-Per-Lead' },
  { value: 'managed', label: 'Managed' },
  { value: 'internal', label: 'Internal' },
] as const;

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  inactive: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

const campaignTypeLabels: Record<string, string> = {
  pay_per_lead: 'PPL',
  managed: 'Managed',
  internal: 'Internal',
};

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

export function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useCampaigns({ status: statusFilter, type: typeFilter, search, page, limit: 10 });
  const campaigns = data?.campaigns;

  // Reset to page 1 when filters change
  const handleStatusChange = (s: string) => { setStatusFilter(s); setPage(1); };
  const handleTypeChange = (t: string) => { setTypeFilter(t); setPage(1); };
  const handleSearchChange = (val: string) => { setSearch(val); setPage(1); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Campaigns" description="Lead generation campaigns synced from LeadByte" />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
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
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTypeChange(tab.value)}
                className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  typeFilter === tab.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
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
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load campaigns"
              description="Something went wrong reaching the server. Try refreshing the page."
            />
          ) : !campaigns?.length ? (
            <EmptyState
              icon={Megaphone}
              title={search || statusFilter !== 'all' || typeFilter !== 'all' ? 'No matching campaigns' : 'No campaigns yet'}
              description={
                search || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try a different filter or search term.'
                  : 'Campaigns sync from LeadByte. Check that LeadByte is connected and has active campaigns.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Today</TableHead>
                    <TableHead className="text-right">Week</TableHead>
                    <TableHead className="text-right">Month</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c: CampaignSummary) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-[140px] sm:max-w-[220px]">
                        <div className="truncate font-medium">{c.name}</div>
                        <div className="truncate text-xs text-muted-foreground">LeadByte ID: {c.id.replace(/^lb-/, '')}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.clientName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">{c.vertical}</Badge>
                          <Badge variant="outline" className="text-xs">{campaignTypeLabels[c.campaignType] ?? 'PPL'}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs capitalize ${statusColors[c.status] || ''}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.leadsToday}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.leadsThisWeek}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.leadsThisMonth}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.totalRevenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.cpl)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={c.margin >= 50 ? 'text-emerald-600' : c.margin >= 30 ? 'text-amber-600' : 'text-destructive'}>
                          {c.margin}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link to={`/campaigns/${c.id}`}>
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
