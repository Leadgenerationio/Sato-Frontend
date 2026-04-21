import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Users, Target, ExternalLink,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useCampaign, useTrafficSources } from '@/lib/hooks/use-campaigns';

type DeliveryWindow = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'ytd';

const WINDOW_OPTIONS: { value: DeliveryWindow; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'ytd', label: 'Year to Date' },
];

function windowRange(win: DeliveryWindow): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0..Sun=6
  switch (win) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 86399999) };
    case 'yesterday': {
      const y = new Date(today.getTime() - 86400000);
      return { start: y, end: new Date(y.getTime() + 86399999) };
    }
    case 'this_week': {
      const start = new Date(today.getTime() - dayOfWeek * 86400000);
      return { start, end: new Date(start.getTime() + 7 * 86400000 - 1) };
    }
    case 'last_week': {
      const endOfLast = new Date(today.getTime() - dayOfWeek * 86400000 - 1);
      const startOfLast = new Date(endOfLast.getTime() - 7 * 86400000 + 1);
      return { start: startOfLast, end: endOfLast };
    }
    case 'this_month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
    case 'last_month':
      return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
    case 'ytd':
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
  }
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  inactive: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function StatCard({ label, value, icon: Icon, trend }: {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          {trend && (
            <span className={`flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-destructive'}`}>
              {trend.positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {trend.value}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading, error } = useCampaign(id!);
  const [window, setWindow] = useState<DeliveryWindow>('this_month');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>Campaign not found</p>
        <Link to="/campaigns"><Button variant="outline"><ArrowLeft className="size-4 mr-2" />Back to campaigns</Button></Link>
      </div>
    );
  }

  const profit = campaign.totalRevenue - campaign.totalCost;

  const { start, end } = windowRange(window);
  const filteredDeliveries = campaign.leadDeliveries.filter((d) => {
    const dt = new Date(d.date);
    return dt >= start && dt <= end;
  });

  // Chart data — filtered by selected window
  const chartData = filteredDeliveries.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    leads: d.leadCount,
    revenue: d.revenue,
    cost: d.cost,
  }));

  const windowTotals = filteredDeliveries.reduce(
    (acc, d) => ({ leads: acc.leads + d.leadCount, revenue: acc.revenue + d.revenue, cost: acc.cost + d.cost }),
    { leads: 0, revenue: 0, cost: 0 },
  );

  // Supplier bar chart data
  const supplierData = campaign.suppliers.map((s) => ({
    name: s.name,
    cpl: s.cpl,
    leads: s.totalLeads,
    spend: s.totalSpend,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/campaigns">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
        </Link>
        <div className="flex-1">
          <PageHeader
            title={campaign.name}
            description={`${campaign.clientName} · ${campaign.vertical}`}
          >
            <Badge className={`capitalize ${statusColors[campaign.status] || ''}`}>
              {campaign.status}
            </Badge>
          </PageHeader>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(campaign.totalRevenue)}
          icon={DollarSign}
          trend={{ value: `${campaign.margin}% margin`, positive: campaign.margin >= 40 }}
        />
        <StatCard
          label="Profit"
          value={formatCurrency(profit)}
          icon={TrendingUp}
          trend={{ value: formatCurrency(campaign.cpl) + ' CPL', positive: true }}
        />
        <StatCard
          label="Total Leads"
          value={campaign.totalLeads.toLocaleString()}
          icon={Users}
        />
        <StatCard
          label="Leads This Week"
          value={campaign.leadsThisWeek.toLocaleString()}
          icon={Target}
          trend={{ value: `${campaign.leadsToday} today`, positive: campaign.leadsToday > 0 }}
        />
      </div>

      {/* Window selector */}
      <Tabs value={window} onValueChange={(v) => setWindow(v as DeliveryWindow)}>
        <TabsList className="flex-wrap gap-1">
          {WINDOW_OPTIONS.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value}>{opt.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Window totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Leads</p><p className="mt-1 text-xl font-bold tabular-nums">{windowTotals.leads.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Revenue</p><p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(windowTotals.revenue)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Cost</p><p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(windowTotals.cost)}</p></CardContent></Card>
      </div>

      {/* Lead Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Volume</CardTitle>
          <CardDescription>{WINDOW_OPTIONS.find((o) => o.value === window)?.label} — daily lead deliveries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No deliveries in this window</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip />
                  <Area type="monotone" dataKey="leads" stroke="#171717" fill="#171717" fillOpacity={0.15} name="Leads" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Revenue vs Cost Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Cost</CardTitle>
          <CardDescription>Daily revenue and cost breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} className="text-muted-foreground" />
                <Tooltip formatter={(value: number) => [`£${value.toFixed(2)}`, '']} />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke="#171717" fill="#171717" fillOpacity={0.1} name="Revenue" />
                <Area type="monotone" dataKey="cost" stroke="#a3a3a3" fill="#a3a3a3" fillOpacity={0.1} name="Cost" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Supplier CPL Comparison */}
      {supplierData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Supplier CPL Comparison</CardTitle>
            <CardDescription>Cost per lead by traffic source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supplierData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} className="text-muted-foreground" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} className="text-muted-foreground" />
                  <Tooltip formatter={(value: number) => [`£${value.toFixed(2)}`, 'CPL']} />
                  <Bar dataKey="cpl" fill="#171717" radius={[0, 4, 4, 0]} name="CPL" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <TrafficSourcesCard campaignId={campaign.id} />
    </div>
  );
}

function TrafficSourcesCard({ campaignId }: { campaignId: string }) {
  const { data: sources, isLoading } = useTrafficSources(campaignId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Traffic Sources</CardTitle>
          <CardDescription>Ad spend per source (pulled from Catchr)</CardDescription>
        </CardHeader>
        <CardContent><Skeleton className="h-40" /></CardContent>
      </Card>
    );
  }

  if (!sources || sources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Traffic Sources</CardTitle>
          <CardDescription>No active traffic sources on this campaign</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalSpend = sources.reduce((s, r) => s + r.totalSpend, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Traffic Sources</CardTitle>
            <CardDescription>
              {sources.length} source{sources.length === 1 ? '' : 's'} · total spend {formatCurrency(totalSpend)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Catchr URL</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">CPL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{s.platform}</Badge></TableCell>
                <TableCell className="text-muted-foreground">
                  {s.catchrUrl ? (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <ExternalLink className="size-3" /> configured
                    </span>
                  ) : (
                    <span className="text-xs">Not set</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.totalSpend)}</TableCell>
                <TableCell className="text-right tabular-nums">{s.totalLeads.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.cpl)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
