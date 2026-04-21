import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useLbResponders } from '@/lib/hooks/use-leadbyte';

function formatMoney(value?: number, currency = 'GBP') {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

export function LeadByteRespondersPage() {
  const { data: responders, isLoading, error } = useLbResponders();

  return (
    <div className="space-y-6">
      <PageHeader title="LeadByte Responders" description="Email/SMS responder configurations + push performance" />

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-6 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}
          {error && (
            <div className="p-6 text-sm text-red-600">Failed to load responders.</div>
          )}
          {responders && responders.length === 0 && (
            <div className="p-6 text-sm text-neutral-500">No responders configured.</div>
          )}
          {responders && responders.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Pushes</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responders.map((r) => {
                  const totalRevenue = (r.pushes ?? []).reduce((acc, p) => acc + (p.revenue ?? 0), 0);
                  const totalProfit = (r.pushes ?? []).reduce((acc, p) => acc + (p.profit ?? 0), 0);
                  return (
                    <TableRow key={String(r.id)}>
                      <TableCell className="font-mono text-xs">{r.reference ?? r.id}</TableCell>
                      <TableCell>{r.campaign?.name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'Active' ? 'default' : 'secondary'}>{r.status ?? 'Unknown'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.pushes?.length ?? 0}</TableCell>
                      <TableCell className="text-right">{formatMoney(totalRevenue)}</TableCell>
                      <TableCell className="text-right">{formatMoney(totalProfit)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
