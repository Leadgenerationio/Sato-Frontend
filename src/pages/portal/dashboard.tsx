import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Megaphone, Users, FileText, AlertTriangle, CheckCircle2, BarChart3, Wallet, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  usePortalDashboard,
  useUpdateAgreementStatus,
  PORTAL_AGREEMENT_STATUSES,
  type PortalAgreementStatus,
} from '@/lib/hooks/use-portal';
import { EmptyState } from '@/components/shared/empty-state';

const STATUS_LABELS: Record<PortalAgreementStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  signed: 'Signed',
};

// Client-admin-only control to correct the agreement status (e.g. for an
// agreement signed outside Stato). A confirmation dialog gates the write
// (AC #4). Non-admins never render this — the dashboard's Agreement stat card
// already shows the status read-only for them.
function AgreementStatusManager({ current }: { current: PortalAgreementStatus }) {
  const [selected, setSelected] = useState<PortalAgreementStatus>(current);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateStatus = useUpdateAgreementStatus();

  const apply = async () => {
    try {
      await updateStatus.mutateAsync(selected);
      toast.success(`Agreement status updated to "${STATUS_LABELS[selected]}".`);
      setConfirmOpen(false);
    } catch {
      toast.error('Could not update agreement status. Please try again.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agreement status</CardTitle>
        <CardDescription>
          Signed outside Stato? Update the status here so your dashboard reflects reality.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Current:</span>
          <Badge variant="secondary">{STATUS_LABELS[current]}</Badge>
          <select
            aria-label="Agreement status"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value as PortalAgreementStatus)}
          >
            {PORTAL_AGREEMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={selected === current}
            onClick={() => setConfirmOpen(true)}
          >
            Update status
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open) setConfirmOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change agreement status?</DialogTitle>
            <DialogDescription>
              This will change your agreement status from <strong>{STATUS_LABELS[current]}</strong> to{' '}
              <strong>{STATUS_LABELS[selected]}</strong>. This action is recorded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={updateStatus.isPending}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={updateStatus.isPending}>
              {updateStatus.isPending && <Loader2 className="size-4 animate-spin" />}
              Confirm change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

// Sum ad-spend rows into one total per currency, preserving the (spend-desc)
// order the API already returned — first-seen currency wins. Never sums
// across currencies.
function totalsByCurrency(
  rows: { spend: number; currency: string }[],
): { currency: string; total: number }[] {
  const order: string[] = [];
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!totals.has(r.currency)) order.push(r.currency);
    totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.spend);
  }
  return order.map((currency) => ({ currency, total: totals.get(currency)! }));
}

function StatCard({
  label, value, icon: Icon, badge, href,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  badge?: { text: string; variant: 'default' | 'destructive' | 'secondary' };
  href?: string;
}) {
  const card = (
    <Card className={`gap-3 py-5 ${href ? 'transition-colors hover:bg-accent/40 cursor-pointer' : ''}`}>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          {badge && <Badge variant={badge.variant} className="text-xs">{badge.text}</Badge>}
        </div>
        <div className="mt-3">
          <p className="truncate text-2xl font-bold tabular-nums">{value}</p>
          <p className="truncate text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
  if (!href) return card;
  return (
    <Link to={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg" aria-label={`${label} — view details`}>
      {card}
    </Link>
  );
}

export function PortalDashboardPage() {
  const { data, isLoading } = usePortalDashboard();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const chartData = data.recentLeads.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    leads: d.leads,
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{data.companyName}</h1>
          {data.clientType === 'managed' && (
            <Badge variant="secondary" className="text-xs">Managed</Badge>
          )}
        </div>
        <p className="text-muted-foreground">Client Portal</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Campaigns" value={String(data.activeCampaigns)} icon={Megaphone} href="/portal/leads" />
        <StatCard label="Leads This Month" value={data.totalLeadsThisMonth.toLocaleString()} icon={Users} href="/portal/leads" />
        <StatCard
          label="Outstanding"
          value={formatCurrency(data.totalOutstanding)}
          icon={FileText}
          badge={data.overdueInvoices > 0 ? { text: `${data.overdueInvoices} overdue`, variant: 'destructive' } : undefined}
          href="/portal/invoices"
        />
        <StatCard
          label="Agreement"
          value={data.agreementSigned ? 'Signed' : 'Pending'}
          icon={data.agreementSigned ? CheckCircle2 : AlertTriangle}
          badge={{ text: data.agreementSigned ? 'Active' : 'Action needed', variant: data.agreementSigned ? 'secondary' : 'destructive' }}
          href="/portal/agreement"
        />
      </div>

      {/* Client admins get an inline control to correct the agreement status.
          Non-admins see only the read-only Agreement stat card above. */}
      {data.canManageAgreement && (
        <AgreementStatusManager current={data.agreementStatus ?? (data.agreementSigned ? 'signed' : 'pending')} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Lead Deliveries</CardTitle>
          <CardDescription>Last 14 days</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 || chartData.every((d) => d.leads === 0) ? (
            <EmptyState
              icon={BarChart3}
              title="No lead deliveries yet"
              description="Once leads are delivered against your campaigns, you'll see daily volumes here."
            />
          ) : (
            <div className="h-[180px] sm:h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#171717" radius={[4, 4, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ad spend — managed clients only. PPL clients never render this block,
          so there's no behaviour change for them. Per-platform, current month,
          consistent with the "Leads This Month" window above. */}
      {data.clientType === 'managed' && (
        <Card>
          <CardHeader>
            <CardTitle>Ad Spend</CardTitle>
            <CardDescription>By platform · this month</CardDescription>
          </CardHeader>
          <CardContent>
            {!data.adSpendByPlatform || data.adSpendByPlatform.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No ad spend this month"
                description="Once ad spend is recorded against your campaigns this month, the per-platform breakdown will appear here."
              />
            ) : (
              <div className="divide-y">
                {data.adSpendByPlatform.map((row) => (
                  <div key={`${row.platform}-${row.currency}`} className="flex items-center justify-between py-2.5">
                    <span className="text-sm">{row.platform}</span>
                    <span className="text-sm font-medium tabular-nums">{formatCurrency(row.spend, row.currency)}</span>
                  </div>
                ))}
                {/* Totals per currency — a client running ads in more than one
                    currency gets one Total line each, since spend in different
                    currencies can't be summed into a single figure. The common
                    single-currency case renders exactly one "Total" line. */}
                {totalsByCurrency(data.adSpendByPlatform).map(({ currency, total }) => (
                  <div key={currency} className="flex items-center justify-between pt-2.5 font-semibold">
                    <span className="text-sm">Total</span>
                    <span className="text-sm tabular-nums">{formatCurrency(total, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
