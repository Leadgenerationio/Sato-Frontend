import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/layouts/page-header';
import { DashboardSkeleton } from '@/components/shared/loading-skeleton';
import { WidgetContainer, StatSkeleton, WidgetSkeleton } from '@/components/dashboard/widget-container';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  Users,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Megaphone,
  FileText,
  CreditCard,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ─── Dummy Data ───

const revenueData = [
  { month: 'Jan', revenue: 18500, expenses: 12400 },
  { month: 'Feb', revenue: 22300, expenses: 13100 },
  { month: 'Mar', revenue: 19800, expenses: 11900 },
  { month: 'Apr', revenue: 27600, expenses: 14200 },
  { month: 'May', revenue: 32100, expenses: 15800 },
  { month: 'Jun', revenue: 29400, expenses: 14600 },
  { month: 'Jul', revenue: 35200, expenses: 16100 },
  { month: 'Aug', revenue: 31800, expenses: 15300 },
  { month: 'Sep', revenue: 38500, expenses: 17200 },
  { month: 'Oct', revenue: 42100, expenses: 18600 },
  { month: 'Nov', revenue: 39800, expenses: 17800 },
  { month: 'Dec', revenue: 45200, expenses: 19100 },
];

const leadsData = [
  { day: 'Mon', leads: 42 },
  { day: 'Tue', leads: 58 },
  { day: 'Wed', leads: 35 },
  { day: 'Thu', leads: 72 },
  { day: 'Fri', leads: 64 },
  { day: 'Sat', leads: 28 },
  { day: 'Sun', leads: 19 },
];

const campaignData = [
  { name: 'Google Ads', value: 38, color: '#171717' },
  { name: 'Facebook', value: 28, color: '#525252' },
  { name: 'LinkedIn', value: 18, color: '#a3a3a3' },
  { name: 'Email', value: 16, color: '#d4d4d4' },
];

const invoiceData = [
  { month: 'Jul', paid: 24, overdue: 3, pending: 5 },
  { month: 'Aug', paid: 28, overdue: 2, pending: 4 },
  { month: 'Sep', paid: 31, overdue: 4, pending: 6 },
  { month: 'Oct', paid: 35, overdue: 2, pending: 3 },
  { month: 'Nov', paid: 29, overdue: 5, pending: 7 },
  { month: 'Dec', paid: 38, overdue: 1, pending: 4 },
];

const recentOrders = [
  { id: 'INV-1042', customer: 'Apex Media Ltd', email: 'billing@apexmedia.co.uk', amount: '£2,450.00', status: 'Paid', date: '12 Dec' },
  { id: 'INV-1041', customer: 'Brightfield Corp', email: 'accounts@brightfield.io', amount: '£1,890.00', status: 'Overdue', date: '8 Dec' },
  { id: 'INV-1040', customer: 'Clearwater Digital', email: 'finance@clearwater.com', amount: '£3,200.00', status: 'Paid', date: '5 Dec' },
  { id: 'INV-1039', customer: 'Delta Solutions', email: 'pay@deltasol.co.uk', amount: '£950.00', status: 'Pending', date: '3 Dec' },
  { id: 'INV-1038', customer: 'Echo Marketing', email: 'admin@echomarketing.com', amount: '£4,100.00', status: 'Paid', date: '1 Dec' },
];

const recentActivity = [
  { user: 'Sam Owner', action: 'Created invoice INV-1042 for Apex Media Ltd', time: '2 min ago', icon: FileText },
  { user: 'Finance Admin', action: 'Approved payment £2,500 from Clearwater Digital', time: '15 min ago', icon: CreditCard },
  { user: 'Ops Manager', action: 'Launched campaign "Q1 Google Push"', time: '1 hour ago', icon: Megaphone },
  { user: 'System', action: 'Auto-chased overdue invoice INV-1041', time: '2 hours ago', icon: Clock },
  { user: 'Sam Owner', action: 'Added new client Delta Solutions', time: '3 hours ago', icon: Users },
];

// ─── Components ───

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ElementType;
}

function StatCard({ title, value, change, trend, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-100">
            <Icon className="size-5 text-neutral-700" />
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend === 'up' ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {change}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-neutral-900">{value}</p>
          <p className="text-sm text-neutral-500 mt-0.5">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function statusVariant(status: string) {
  switch (status) {
    case 'Paid': return 'default' as const;
    case 'Overdue': return 'destructive' as const;
    case 'Pending': return 'outline' as const;
    default: return 'secondary' as const;
  }
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    fontSize: '12px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  },
};

// ─── Page ───

export function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetch
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!user) return null;
  if (loading) return <DashboardSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name}`}
      />

      {/* Stats — each wrapped in Suspense */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<StatSkeleton />}>
          <StatCard title="Total Revenue" value="£45,231" change="+20.1%" trend="up" icon={DollarSign} />
        </Suspense>
        <Suspense fallback={<StatSkeleton />}>
          <StatCard title="Active Clients" value="24" change="+12.5%" trend="up" icon={Users} />
        </Suspense>
        <Suspense fallback={<StatSkeleton />}>
          <StatCard title="Campaigns" value="12" change="+2" trend="up" icon={TrendingUp} />
        </Suspense>
        <Suspense fallback={<StatSkeleton />}>
          <StatCard title="Conversion Rate" value="3.2%" change="-0.4%" trend="down" icon={Activity} />
        </Suspense>
      </div>

      {/* Charts Row 1: Revenue + Leads */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue Area Chart */}
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-2" />}>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Monthly revenue vs expenses (2025)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#171717" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#171717" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a3a3a3" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#a3a3a3" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(value: any) => [`£${Number(value).toLocaleString()}`, '']} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#171717" strokeWidth={2} fill="url(#revenueGrad)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#a3a3a3" strokeWidth={2} fill="url(#expenseGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>

        {/* Leads Bar Chart */}
        <WidgetContainer>
        <Card>
          <CardHeader>
            <CardTitle>Leads This Week</CardTitle>
            <CardDescription>Daily lead volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="leads" name="Leads" fill="#171717" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>
      </div>

      {/* Charts Row 2: Campaigns Pie + Invoice Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Campaign Sources Pie */}
        <WidgetContainer>
        <Card>
          <CardHeader>
            <CardTitle>Campaign Sources</CardTitle>
            <CardDescription>Lead distribution by channel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={campaignData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    stroke="none"
                  >
                    {campaignData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(value: any) => [`${value}%`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {campaignData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-neutral-600">{item.name}</span>
                  <span className="text-xs font-medium text-neutral-900 ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>

        {/* Invoice Stacked Bar */}
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-2" />}>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invoice Status</CardTitle>
            <CardDescription>Monthly breakdown by payment status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invoiceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                  <Tooltip {...tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="paid" name="Paid" stackId="a" fill="#171717" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pending" name="Pending" stackId="a" fill="#a3a3a3" />
                  <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>
      </div>

      {/* Table + Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        {/* Recent Invoices */}
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-4" height="h-[350px]" />}>
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Latest billing activity</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{order.id}</div>
                        <div className="text-xs text-muted-foreground">{order.date}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{order.customer}</div>
                        <div className="text-xs text-muted-foreground">{order.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{order.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </WidgetContainer>

        {/* Activity Feed */}
        <WidgetContainer fallback={<WidgetSkeleton className="lg:col-span-3" height="h-[350px]" />}>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 mt-0.5">
                    <item.icon className="size-4 text-neutral-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none">{item.user}</p>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.action}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </WidgetContainer>
      </div>
    </div>
  );
}
