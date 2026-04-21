import { useState } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useLbDeliveries } from '@/lib/hooks/use-leadbyte';

const STATUS_TABS = ['all', 'Active', 'Inactive', 'Saved'] as const;

export function LeadByteDeliveriesPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>('all');
  const status = statusFilter === 'all' ? undefined : statusFilter;
  const { data: deliveries, isLoading, error } = useLbDeliveries(status);

  return (
    <div className="space-y-6">
      <PageHeader title="LeadByte Deliveries" description="Delivery rules and routing configured in LeadByte" />

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
            <div className="p-6 text-sm text-red-600">Failed to load deliveries.</div>
          )}
          {deliveries && deliveries.length === 0 && (
            <div className="p-6 text-sm text-neutral-500">No deliveries found.</div>
          )}
          {deliveries && deliveries.length > 0 && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
