import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink,
  Building2, Database, Megaphone, FileSignature, HardDrive, Mail, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface IntegrationsOverview {
  xero: { configured: boolean; connected: boolean; tenantName: string | null };
  leadbyte: { configured: boolean; lastSyncAt: string | null; leadsThisMonth: number };
  catchr: { configured: boolean; lastSyncAt: string | null; adSpendLast30Days: number; currency: string };
  signnow: { configured: boolean; sandbox: boolean; agreementCount: number };
  r2: { configured: boolean; bucket: string | null; fileCount: number };
  resend: { configured: boolean; fromEmail: string | null };
  creditCheck: { configured: boolean; provider: 'creditsafe' | 'endole' | 'mock'; sandbox?: boolean; checksRun: number };
}

type CardStatus = 'live' | 'mock' | 'not_configured';

interface CardSpec {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  status: CardStatus;
  metricLabel: string;
  metricValue: string;
  detail?: string;
  lastSyncAt?: string | null;
  primaryAction?: { label: string; onClick: () => void; icon?: React.ElementType };
  secondaryAction?: { label: string; href: string };
}

function formatCurrency(value: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function StatusPill({ status }: { status: CardStatus }) {
  if (status === 'live') {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
        <CheckCircle2 className="size-3 mr-1" /> Live
      </Badge>
    );
  }
  if (status === 'mock') {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
        <AlertCircle className="size-3 mr-1" /> Mock
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <XCircle className="size-3 mr-1" /> Not configured
    </Badge>
  );
}

function IntegrationCard({ spec }: { spec: CardSpec }) {
  const Icon = spec.icon;
  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute top-0 left-0 h-1 w-full"
        style={{ background: spec.status === 'live' ? '#10b981' : spec.status === 'mock' ? '#f59e0b' : '#737373' }}
      />
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${spec.iconColor}15` }}
            >
              <Icon className="size-6" style={{ color: spec.iconColor }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-tight">{spec.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{spec.description}</p>
            </div>
          </div>
          <StatusPill status={spec.status} />
        </div>

        <div>
          <p className="text-3xl font-bold tabular-nums leading-none">{spec.metricValue}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{spec.metricLabel}</p>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {spec.lastSyncAt !== undefined ? (
            <span className="flex items-center gap-1.5">
              <RefreshCw className="size-3" />
              Synced {formatRelative(spec.lastSyncAt)}
            </span>
          ) : (
            <span className="truncate">{spec.detail ?? ' '}</span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          {spec.primaryAction && (
            <Button size="sm" variant="outline" onClick={spec.primaryAction.onClick}>
              {spec.primaryAction.icon && <spec.primaryAction.icon className="size-4" />}
              {spec.primaryAction.label}
            </Button>
          )}
          {spec.secondaryAction && (
            <Button size="sm" variant="ghost" asChild>
              <a href={spec.secondaryAction.href}>
                {spec.secondaryAction.label}
                <ExternalLink className="size-3 ml-1" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function statusFor(configured: boolean, live: boolean): CardStatus {
  if (live) return 'live';
  if (configured) return 'mock';
  return 'not_configured';
}

export function IntegrationsPage() {
  const navigate = useNavigate();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['integrations-overview'],
    queryFn: async () => {
      const res = await api.get<IntegrationsOverview>('/api/v1/integrations/overview');
      return unwrap(res);
    },
  });

  async function syncLeadByteNow() {
    try {
      await api.post('/api/v1/integrations/leadbyte/sync');
      toast.success('LeadByte sync enqueued');
      setTimeout(() => refetch(), 2000);
    } catch (err) {
      console.error('Operation failed', err);
      toast.error('Failed to enqueue sync');
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Integrations" description="Live status of every connected service" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const cards: CardSpec[] = [
    {
      key: 'xero',
      title: 'Xero',
      description: 'Accounting · invoices · bank balances',
      icon: Building2,
      iconColor: '#13B5EA',
      status: statusFor(data.xero.configured, data.xero.connected),
      metricLabel: 'Organisation',
      metricValue: data.xero.tenantName ?? (data.xero.configured ? 'Auth pending' : '—'),
      secondaryAction: { label: 'Open Xero', href: 'https://go.xero.com' },
    },
    {
      key: 'leadbyte',
      title: 'LeadByte',
      description: 'Lead management · hourly sync',
      icon: Database,
      iconColor: '#FF6B35',
      status: statusFor(data.leadbyte.configured, data.leadbyte.configured),
      metricLabel: 'Leads this month',
      metricValue: data.leadbyte.leadsThisMonth.toLocaleString(),
      lastSyncAt: data.leadbyte.lastSyncAt,
      primaryAction: { label: 'Sync now', icon: RefreshCw, onClick: syncLeadByteNow },
    },
    {
      key: 'catchr',
      title: 'Catchr',
      description: 'Multi-platform ad-spend aggregation',
      icon: Megaphone,
      iconColor: '#0ea5e9',
      status: statusFor(data.catchr.configured, data.catchr.configured),
      metricLabel: 'Ad spend · last 30 days',
      metricValue: formatCurrency(data.catchr.adSpendLast30Days, data.catchr.currency),
      lastSyncAt: data.catchr.lastSyncAt,
      secondaryAction: { label: 'View Reports', href: '/reports/unified' },
    },
    {
      key: 'signnow',
      title: 'SignNow',
      description: 'E-signature for service agreements',
      icon: FileSignature,
      iconColor: '#22c55e',
      status: statusFor(data.signnow.configured, data.signnow.configured && !data.signnow.sandbox),
      metricLabel: 'Agreements sent',
      metricValue: data.signnow.agreementCount.toLocaleString(),
      detail: data.signnow.sandbox ? 'Sandbox mode — switch to production URL' : 'Production',
      secondaryAction: { label: 'View agreements', href: '/agreements' },
    },
    {
      key: 'r2',
      title: 'Cloudflare R2',
      description: 'File storage · creatives, agreements, invoices',
      icon: HardDrive,
      iconColor: '#f6821f',
      status: statusFor(data.r2.configured, data.r2.configured),
      metricLabel: 'Files stored',
      metricValue: data.r2.fileCount.toLocaleString(),
      detail: data.r2.bucket ?? '—',
    },
    {
      key: 'creditCheck',
      title: 'Credit checks',
      description: data.creditCheck.provider === 'mock' ? 'No provider configured' : `Powered by ${data.creditCheck.provider === 'creditsafe' ? 'Creditsafe' : 'Endole'}`,
      icon: ShieldCheck,
      iconColor: '#8b5cf6',
      status: statusFor(true, data.creditCheck.configured && !data.creditCheck.sandbox),
      metricLabel: 'Checks run',
      metricValue: data.creditCheck.checksRun.toLocaleString(),
      detail: data.creditCheck.sandbox
        ? 'SANDBOX — returns sample data, not real scores. Unset ENDOLE_SANDBOX to switch to production.'
        : `Provider: ${data.creditCheck.provider}`,
    },
    {
      key: 'resend',
      title: 'Resend',
      description: 'Transactional email · invoices, alerts',
      icon: Mail,
      iconColor: '#6366f1',
      status: statusFor(data.resend.configured, data.resend.configured),
      metricLabel: 'Sender',
      metricValue: data.resend.fromEmail ?? '—',
      detail: data.resend.fromEmail?.includes('resend.dev')
        ? 'Pending GoDaddy DNS to switch to verified domain'
        : 'Domain verified',
    },
  ];

  const liveCount = cards.filter((c) => c.status === 'live').length;
  const mockCount = cards.filter((c) => c.status === 'mock').length;
  const notConfiguredCount = cards.filter((c) => c.status === 'not_configured').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrations"
        description="Live status of every connected service. Click any card to drill in."
      >
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          Refresh
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="gap-2 py-4">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold tabular-nums">{liveCount}</p>
              <p className="text-xs text-muted-foreground">Live</p>
            </div>
            <CheckCircle2 className="size-6 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold tabular-nums">{mockCount}</p>
              <p className="text-xs text-muted-foreground">Mock / partial</p>
            </div>
            <AlertCircle className="size-6 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold tabular-nums">{notConfiguredCount}</p>
              <p className="text-xs text-muted-foreground">Not configured</p>
            </div>
            <XCircle className="size-6 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((spec) => (
          <button
            key={spec.key}
            type="button"
            className="text-left"
            onClick={() => navigate('/settings')}
          >
            <IntegrationCard spec={spec} />
          </button>
        ))}
      </div>
    </div>
  );
}
