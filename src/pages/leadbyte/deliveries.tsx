import { useState } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useLbDeliveries } from '@/lib/hooks/use-leadbyte';
import { EmptyState } from '@/components/shared/empty-state';
import { Truck, AlertTriangle } from 'lucide-react';

const STATUS_TABS = ['all', 'Active', 'Inactive', 'Saved'] as const;

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function LeadByteDeliveriesPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>('all');
  const status = statusFilter === 'all' ? undefined : statusFilter;
  const { data: deliveries, isLoading, error } = useLbDeliveries(status);
  // Always pull the full list for the count summary so the stat cards don't
  // change when the user filters the table.
  const { data: allDeliveries } = useLbDeliveries();
  const totalCount = allDeliveries?.length ?? 0;
  const activeCount = allDeliveries?.filter((d) => d.status === 'Active').length ?? 0;
  const inactiveCount = allDeliveries?.filter((d) => d.status === 'Inactive').length ?? 0;
  const savedCount = allDeliveries?.filter((d) => d.status === 'Saved').length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="LeadByte Deliveries"
        description="Each row is a delivery rule — where leads from a campaign are routed (buyer, email, SMS, direct post). Counts below show how many rules are configured, not lead volume."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={totalCount} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="Inactive" value={inactiveCount} />
        <StatCard label="Saved" value={savedCount} />
      </div>

      <div className="flex gap-2">
        {STATUS_TABS.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : s}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-6 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}
          {error && (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load deliveries"
              description="LeadByte may be unreachable. Try again in a moment."
            />
          )}
          {deliveries && deliveries.length === 0 && (
            <EmptyState
              icon={Truck}
              title={statusFilter === 'all' ? 'No deliveries yet' : `No ${statusFilter.toLowerCase()} deliveries`}
              description={
                statusFilter === 'all'
                  ? 'Delivery rules sync from LeadByte. Configure routing in LeadByte to populate this list.'
                  : 'No deliveries match this filter. Try switching to "All".'
              }
            />
          )}
          {deliveries && deliveries.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={String(d.id)}>
                      <TableCell className="font-mono text-xs">{d.reference ?? d.id}</TableCell>
                      <TableCell>{d.campaign?.name ?? '—'}</TableCell>
                      <TableCell>{d.deliver_to ?? '—'}</TableCell>
                      <TableCell>{d.buyer?.name ?? '—'} {d.buyer?.bid && <span className="text-neutral-400">({d.buyer.bid})</span>}</TableCell>
                      <TableCell>
                        <Badge variant={d.status === 'Active' ? 'default' : 'secondary'}>{d.status ?? 'Unknown'}</Badge>
                      </TableCell>
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
