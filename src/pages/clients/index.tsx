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
import { Search, ExternalLink, Plus, Users, AlertTriangle, Download } from 'lucide-react';
import { useClients, type ClientSummary } from '@/lib/hooks/use-clients';
import { resolveDisplayedStatus } from './detail';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/shared/empty-state';

// Sam Loom #31 (13 May response) — only 3 statuses: Onboarding, Active
// Client, Client Churned. 'prospect' and 'paused' were dropped; existing
// rows migrated via 0022. UI labels diverge from DB values (we render
// the longer label) so the underlying enum stays clean.
const STATUS_TABS = ['all', 'onboarding', 'active', 'churned'] as const;

const statusColors: Record<string, string> = {
  onboarding: 'bg-blue-500/10 text-blue-600 border-blue-200',
  active:     'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  churned:    'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

const statusLabels: Record<string, string> = {
  all: 'All',
  onboarding: 'Onboarding',
  active: 'Active Client',
  churned: 'Client Churned',
};

function creditBadge(score: number | null) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  let color = 'text-emerald-600';
  if (score < 50) color = 'text-red-600';
  else if (score < 65) color = 'text-amber-600';
  return <span className={`text-sm font-medium tabular-nums ${color}`}>{score}</span>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

export function ClientsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useClients({ status: statusFilter, search: debouncedSearch, page, limit: 10 });
  const clients = data?.clients;

  const handleStatusChange = (s: string) => { setStatusFilter(s); setPage(1); };
  const handleSearchChange = (val: string) => { setSearch(val); setPage(1); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clients" description="Manage your client accounts">
        <div className="flex items-center gap-2">
          <Link to="/clients/import">
            <Button size="sm" variant="outline">
              <Download className="size-4 mr-1.5" />
              Import from Attio
            </Button>
          </Link>
          <Link to="/clients/create">
            <Button size="sm">
              <Plus className="size-4 mr-1.5" />
              New Client
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleStatusChange(tab)}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {statusLabels[tab] ?? tab}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search clients..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-28" /><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-16" /></div>
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load clients"
              description="Something went wrong reaching the server. Try refreshing the page."
            />
          ) : !clients?.length ? (
            <EmptyState
              icon={Users}
              title={search || statusFilter !== 'all' ? 'No matching clients' : 'No clients yet'}
              description={
                search || statusFilter !== 'all'
                  ? 'Try a different search or filter.'
                  : 'Add your first client to start tracking campaigns, invoices, and credit.'
              }
              link={search || statusFilter !== 'all' ? undefined : { label: 'Add client', to: '/clients/new', icon: Plus }}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Credit</TableHead>
                    <TableHead className="text-right">Campaigns</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c: ClientSummary) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.companyName}</TableCell>
                      <TableCell>
                        <div className="text-sm">{c.contactName}</div>
                        <div className="text-xs text-muted-foreground">{c.contactEmail}</div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // Apply the same reality-check the detail-page badge does:
                          // "Active Client" only renders when docs + signed agreement
                          // are both real — otherwise downgrade to "Onboarding".
                          const displayed = resolveDisplayedStatus(c.status, c.agreementSigned, c.documentsCount);
                          return (
                            <Badge className={`text-xs ${statusColors[displayed] || ''}`}>{statusLabels[displayed] ?? displayed}</Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-center">{creditBadge(c.creditScore)}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.activeCampaigns}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.totalRevenue)}</TableCell>
                      <TableCell>
                        <Link to={`/clients/${c.id}`}>
                          <Button variant="ghost" size="icon" className="size-8"><ExternalLink className="size-4" /></Button>
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
