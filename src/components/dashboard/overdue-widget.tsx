import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface OverdueInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
  daysOverdue: number;
  currency: string;
}

const MOCK_OVERDUE: OverdueInvoice[] = [
  { id: 'inv-1046', invoiceNumber: 'INV-1046', clientName: 'Echo Marketing', total: 1900.80, daysOverdue: 22, currency: 'EUR' },
  { id: 'inv-1041', invoiceNumber: 'INV-1041', clientName: 'Echo Marketing', total: 5026.80, daysOverdue: 2, currency: 'EUR' },
  { id: 'inv-1036', invoiceNumber: 'INV-1036', clientName: 'Clearwater Digital', total: 2106.00, daysOverdue: 15, currency: 'GBP' },
  { id: 'inv-1031', invoiceNumber: 'INV-1031', clientName: 'Apex Media Ltd', total: 3508.80, daysOverdue: 8, currency: 'GBP' },
];

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function severityColor(days: number) {
  if (days > 7) return 'bg-red-500/10 text-red-600 border-red-200';
  return 'bg-amber-500/10 text-amber-600 border-amber-200';
}

export function OverdueWidget() {
  const totalOverdue = MOCK_OVERDUE.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Overdue Invoices</CardTitle>
            <CardDescription>{MOCK_OVERDUE.length} invoice{MOCK_OVERDUE.length !== 1 ? 's' : ''} overdue</CardDescription>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10">
            <AlertTriangle className="size-5 text-red-600" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center py-2">
          <p className="text-3xl font-bold tabular-nums text-red-600">{formatCurrency(totalOverdue)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total outstanding</p>
        </div>

        <div className="space-y-2">
          {MOCK_OVERDUE.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border p-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground truncate">{inv.clientName}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Badge className={`text-xs ${severityColor(inv.daysOverdue)}`}>
                  {inv.daysOverdue}d
                </Badge>
                <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                  {formatCurrency(inv.total, inv.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <Link to="/finance/invoices?status=overdue">
          <Button variant="outline" size="sm" className="w-full mt-2">
            <ExternalLink className="size-4 mr-1.5" />
            View All Overdue
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
