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
import { Search, ExternalLink, Plus, Users, AlertTriangle } from 'lucide-react';
import { useClients, type ClientSummary } from '@/lib/hooks/use-clients';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/shared/empty-state';

const STATUS_TABS = ['all', 'prospect', 'onboarding', 'active', 'paused', 'churned'] as const;

const statusColors: Record<string, string> = {
  prospect: 'bg-blue-500/10 text-blue-600 border-blue-200',
  onboarding: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  churned: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
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
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useClients({ status: statusFilter, search, page, limit: 10 });
  const clients = data?.clients;

  const handleStatusChange = (s: string) => { setStatusFilter(s); setPage(1); };
  const handleSearchChange = (val: string) => { setSearch(val); setPage(1); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clients" description="Manage your client accounts">
        <Link to="/clients/create">
          <Button size="sm">
            <Plus className="size-4 mr-1.5" />
            New Client
          </Button>
        </Link>
      </PageHeader>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleStatusChange(tab)}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                statusFilter === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
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
                        <Badge className={`text-xs capitalize ${statusColors[c.status] || ''}`}>{c.status}</Badge>
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
