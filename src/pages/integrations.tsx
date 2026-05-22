import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '@/lib/api';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink,
  Building2, Database, Megaphone, FileSignature, HardDrive, Mail, ShieldCheck,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { toast } from 'sonner';

import { logError } from '../lib/log';

interface SkippedCampaign {
  campaignId: string;
  campaignName: string | null;
  buyerCount: number;
  at: string;
}

interface IntegrationsOverview {
  xero: { configured: boolean; connected: boolean; tenantName: string | null; lastError: string | null };
  leadbyte: { configured: boolean; lastSyncAt: string | null; leadsThisMonth: number; leadsLast12Months?: number; skippedCampaigns?: SkippedCampaign[] };
  catchr: { configured: boolean; connected: boolean; platformsConnected: number; lastError: string | null; lastSyncAt: string | null; adSpendLast30Days: number; currency: string };
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
  // Override the default `text-3xl font-bold tabular-nums` styling — used by
  // cards whose metric is text rather than a big number (e.g. Resend sender).
  metricValueClassName?: string;
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
    // "Mock" was the original copy when the only failure mode was "no creds
    // → return canned demo data". Today's failures are mostly transient
    // probe / API errors with the integration otherwise healthy, so the
    // word "Mock" misleads (Sam read it as "we faked the data"). Renamed
    // to "Degraded" — same amber pill, accurate copy.
    return (
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
        <AlertCircle className="size-3 mr-1" /> Degraded
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

        <div className="min-w-0">
          <p
            className={`leading-none truncate ${spec.metricValueClassName ?? 'text-3xl font-bold tabular-nums'}`}
            title={spec.metricValue}
          >
            {spec.metricValue}
          </p>
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

/**
 * Multi-buyer campaigns the LeadByte sync skipped during the last run(s).
 * LeadByte's /reports/* endpoints don't expose per-buyer daily granularity,
 * so we can't safely attribute campaign-level daily totals across multiple
 * linked clients. The sync logs each skip into an in-memory FIFO buffer
 * (last 100 events) — this panel surfaces them so operators can see
 * attribution gaps without grepping Railway logs.
 *
 * Hidden entirely when the array is empty: the whole point is an
 * exception view; no skips = nothing to show.
 */
function LeadByteSkippedCampaigns({ skipped }: { skipped: SkippedCampaign[] }) {
  const [open, setOpen] = useState(false);
  if (skipped.length === 0) return null;
  return (
    <Card data-testid="leadbyte-skipped-section">
      <CardContent className="p-4 space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-amber-600" />
            <span className="text-sm font-medium">
              LeadByte — Multi-buyer campaigns skipped ({skipped.length})
            </span>
          </div>
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        <p
          className="flex items-start gap-1.5 text-xs text-muted-foreground"
          title="LeadByte's API does not provide per-buyer daily granularity for multi-buyer campaigns. Revenue attribution is paused until LeadByte adds this capability."
        >
          <Info className="mt-0.5 size-3 shrink-0" />
          <span>
            LeadByte's API does not provide per-buyer daily granularity for
            multi-buyer campaigns. Revenue attribution is paused until
            LeadByte adds this capability.
          </span>
        </p>
        {open && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Buyers</TableHead>
                <TableHead className="text-right">Last skipped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skipped.map((s) => (
                <TableRow key={`${s.campaignId}-${s.at}`}>
                  <TableCell className="font-mono text-xs">
                    {s.campaignName ?? s.campaignId}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.buyerCount}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatRelative(s.at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
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
      logError('Operation failed', err);
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
    // When credentials are present but the token exchange hasn't succeeded
    // yet, the card shows "Auth pending" — almost always because the Xero
    // Custom Connection app is missing one of the 5 scopes Stato requests
    // (most often `finance.statements.read`, the Finance API scope). In
    // that state, "Open Xero" → go.xero.com (the org dashboard) is the
    // wrong destination; the user needs developer.xero.com → their app →
    // scopes. We route there + show a hint listing the scopes.
    (() => {
      const xeroAuthPending = data.xero.configured && !data.xero.connected;
      // Auth succeeded but a data-endpoint probe (e.g. /Accounts) is failing.
      // Most common cause is a 429 rate-limit — the auth-token cache says
      // "connected" but bank/invoice fetches throw. Surface this so the
      // Integrations card matches what the Bank widget will actually show.
      const xeroDataDegraded =
        data.xero.configured && data.xero.connected && !!data.xero.lastError;
      // Translate the OAuth error code from Xero into an action the operator
      // can take without leaving this page. Unknown codes fall through to the
      // raw message so we never hide useful detail.
      function explainError(code: string | null | undefined): string {
        if (!code) return 'Enable scopes: accounting.* + finance.statements.read';
        const c = code.toLowerCase();
        if (c.includes('invalid_scope')) {
          return 'Scope rejected by Xero — tick accounting.* + finance.statements.read in the developer portal, then re-save.';
        }
        if (c.includes('invalid_client') || c.includes('unauthorized_client')) {
          return 'Client ID/Secret rejected — verify XERO_CLIENT_ID and XERO_CLIENT_SECRET on Railway match the values in the Xero portal.';
        }
        if (c.includes('invalid_grant')) {
          return 'Connection revoked in Xero — re-authorise the Custom Connection in the developer portal.';
        }
        if (c.includes('429') || c.toLowerCase().includes('rate')) {
          return 'Xero rate-limited (HTTP 429) — bank balances + invoices temporarily unavailable. Xero resets the limit within ~60s; no action needed unless this persists for 10+ minutes.';
        }
        return `Xero rejected the connection: ${code}`;
      }
      // Status: Auth-pending OR data-degraded both flip the card off "Live".
      // statusFor(true, false) returns "Degraded".
      const status = statusFor(
        data.xero.configured,
        data.xero.connected && !xeroDataDegraded,
      );
      return {
        key: 'xero',
        title: 'Xero',
        description: 'Accounting · invoices · bank balances',
        icon: Building2,
        iconColor: '#13B5EA',
        status,
        metricLabel: 'Organisation',
        metricValue: data.xero.tenantName ?? (data.xero.configured ? 'Auth pending' : '—'),
        detail: xeroAuthPending || xeroDataDegraded
          ? explainError(data.xero.lastError)
          : undefined,
        secondaryAction: xeroAuthPending
          ? { label: 'Configure in Xero', href: 'https://developer.xero.com/app/manage/app/843a4b14-559d-45ee-a193-f13b9ff35667' }
          : { label: 'Open Xero', href: 'https://go.xero.com' },
      };
    })(),
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
      // Card flips to "Mock" the moment the Catchr probe fails (expired
      // token, transient outage, zero connected platforms). The detail
      // line surfaces the actual error code so the operator doesn't have
      // to grep Railway logs — same self-diagnostic pattern as Xero.
      status: statusFor(data.catchr.configured, data.catchr.connected),
      metricLabel: 'Ad spend · last 30 days',
      metricValue: formatCurrency(data.catchr.adSpendLast30Days, data.catchr.currency),
      detail: data.catchr.configured && !data.catchr.connected
        ? data.catchr.lastError
          ? `Catchr API: ${data.catchr.lastError}`
          : 'Token present but Catchr returned no connected platforms — check app.catchr.io/logs/connections.'
        : data.catchr.connected
          ? `${data.catchr.platformsConnected} platform${data.catchr.platformsConnected === 1 ? '' : 's'} connected`
          : undefined,
      lastSyncAt: data.catchr.lastSyncAt,
      secondaryAction: data.catchr.configured && !data.catchr.connected
        ? { label: 'Open Catchr connections', href: 'https://app.catchr.io/logs/connections' }
        : { label: 'View Reports', href: '/reports/unified' },
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
      // Email addresses don't fit the at-a-glance big-number treatment; demote
      // below the integration title so the hierarchy reads name → status → addr.
      metricValueClassName: 'text-sm font-medium',
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
              <p className="text-xs text-muted-foreground">Degraded / probe failed</p>
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

      <LeadByteSkippedCampaigns skipped={data.leadbyte.skippedCampaigns ?? []} />
    </div>
  );
}
