import { useState } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useLbBuyers, useUpdateLbBuyer, type LbBuyer } from '@/lib/hooks/use-leadbyte';
import { EmptyState } from '@/components/shared/empty-state';
import { Building2, AlertTriangle } from 'lucide-react';

const STATUS_TABS = ['all', 'Active', 'Inactive'] as const;

function formatMoney(value?: number, currency = 'GBP') {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

export function LeadByteBuyersPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>('all');
  const { data: buyers, isLoading, error } = useLbBuyers(statusFilter === 'all' ? undefined : statusFilter);
  const updateBuyer = useUpdateLbBuyer();

  const toggleStatus = (buyer: LbBuyer) => {
    if (!buyer.id) return;
    updateBuyer.mutate({
      id: buyer.id,
      update: { status: buyer.status === 'Active' ? 'Inactive' : 'Active' },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="LeadByte Buyers" description="Buyers synced from LeadByte — status & credit" />

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
              title="Couldn't load buyers"
              description="LeadByte may be unreachable. Check that LEADBYTE_API_KEY is configured on the backend."
            />
          )}
          {buyers && buyers.length === 0 && (
            <EmptyState
              icon={Building2}
              title={statusFilter === 'all' ? 'No buyers yet' : `No ${statusFilter.toLowerCase()} buyers`}
              description={
                statusFilter === 'all'
                  ? 'Buyers sync from LeadByte. Add a buyer in LeadByte and it will appear here.'
                  : 'No buyers match this filter. Try switching to "All".'
              }
            />
          )}
          {buyers && buyers.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>BID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Credit Amount</TableHead>
                    <TableHead className="text-right">Credit Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buyers.map((b) => (
                    <TableRow key={String(b.id ?? b.bid ?? b.company)}>
                      <TableCell className="font-medium">{b.company}</TableCell>
                      <TableCell className="font-mono text-xs">{b.bid ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={b.status === 'Active' ? 'default' : 'secondary'}>{b.status ?? 'Unknown'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(b.credit_amount)}</TableCell>
                      <TableCell className="text-right">{formatMoney(b.credit_balance)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateBuyer.isPending || !b.id}
                          onClick={() => toggleStatus(b)}
                        >
                          {b.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </Button>
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
