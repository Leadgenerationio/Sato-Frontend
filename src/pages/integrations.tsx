import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '@/lib/api';
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink,
  Building2, Database, Megaphone, FileSignature, HardDrive, Mail, ShieldCheck,
  ChevronDown, ChevronUp, Info, Sparkles,
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
  // Sam-Loom (jam-video #10) — surfaced so operators can see at a glance
  // whether the AI-task suggestion key is wired in this env. `undefined` =
  // older API response that doesn't carry this field; treat as unknown
  // rather than as a hard "not configured".
  anthropic?: { configured: boolean };
}

type CardStatus = 'live' | 'mock' | 'not_configured';

// Maps an integration's brand accent to the Statto icon-tint class.
type IconTint = 'blue' | 'orange' | 'green' | 'purple';

interface CardSpec {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconTint: IconTint;
  status: CardStatus;
  metricLabel: string;
  metricValue: string;
  // Override the default big-number styling — used by cards whose metric is
  // text rather than a big number (e.g. Resend sender, AI status).
  metricSize?: 'big' | 'med';
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
      <span className="pill p-pos intg-live">
        <CheckCircle2 className="size-3" strokeWidth={2.4} /> Live
      </span>
    );
  }
  if (status === 'mock') {
    // "Mock" was the original copy when the only failure mode was "no creds
    // → return canned demo data". Today's failures are mostly transient
    // probe / API errors with the integration otherwise healthy, so the
    // word "Mock" misleads (Sam read it as "we faked the data"). Renamed
    // to "Degraded" — same amber pill, accurate copy.
    return (
      <span className="pill p-warn intg-live">
        <AlertCircle className="size-3" strokeWidth={2.4} /> Degraded
      </span>
    );
  }
  return (
    <span className="pill p-gray intg-live">
      <XCircle className="size-3" strokeWidth={2.4} /> Not configured
    </span>
  );
}

function IntegrationCard({ spec }: { spec: CardSpec }) {
  const Icon = spec.icon;
  const accentColor =
    spec.status === 'live' ? 'var(--positive)' : spec.status === 'mock' ? 'var(--warning)' : 'var(--fg3)';
  return (
    <>
      <div className="intg-accent" style={{ background: accentColor }} />
      <div className="intg-body">
        <div className="intg-head">
          <span className={`intg-ic ${spec.iconTint}`}>
            <Icon className="size-[22px]" />
          </span>
          <div className="intg-name-wrap">
            <div className="intg-name">{spec.title}</div>
            <div className="intg-desc">{spec.description}</div>
          </div>
          <StatusPill status={spec.status} />
        </div>

        <div
          className={'intg-value' + (spec.metricSize === 'big' ? ' big' : spec.metricSize === 'med' ? ' med' : '')}
          title={spec.metricValue}
        >
          {spec.metricValue}
        </div>
        <div className="intg-sub">{spec.metricLabel}</div>

        {spec.lastSyncAt !== undefined ? (
          <div className="intg-meta">
            <RefreshCw className="size-[13px]" /> Synced {formatRelative(spec.lastSyncAt)}
          </div>
        ) : spec.detail ? (
          <div className="intg-note">{spec.detail}</div>
        ) : null}

        {spec.lastSyncAt !== undefined && spec.detail && <div className="intg-note">{spec.detail}</div>}

        {spec.primaryAction && (
          <span
            className="intg-action dark"
            onClick={(e) => {
              e.stopPropagation();
              spec.primaryAction!.onClick();
            }}
          >
            {spec.primaryAction.icon && <spec.primaryAction.icon className="size-[15px]" />}
            {spec.primaryAction.label}
          </span>
        )}
        {spec.secondaryAction && (
          <a
            className="intg-action"
            href={spec.secondaryAction.href}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-[15px]" /> {spec.secondaryAction.label}
          </a>
        )}
      </div>
    </>
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
 * attribution gaps without grepping server logs.
 *
 * Hidden entirely when the array is empty: the whole point is an
 * exception view; no skips = nothing to show.
 */
function LeadByteSkippedCampaigns({ skipped }: { skipped: SkippedCampaign[] }) {
  const [open, setOpen] = useState(false);
  if (skipped.length === 0) return null;
  return (
    <div className="card pad acard" data-testid="leadbyte-skipped-section">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4" style={{ color: 'var(--warning)' }} />
          <span className="statto-title" style={{ fontSize: 15 }}>
            LeadByte — Multi-buyer campaigns skipped ({skipped.length})
          </span>
        </div>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      <p
        className="ac-sub"
        style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 10 }}
        title="LeadByte's API does not provide per-buyer daily granularity for multi-buyer campaigns. Revenue attribution is paused until LeadByte adds this capability."
      >
        <Info className="size-3 shrink-0" style={{ marginTop: 3 }} />
        <span>
          LeadByte's API does not provide per-buyer daily granularity for
          multi-buyer campaigns. Revenue attribution is paused until
          LeadByte adds this capability.
        </span>
      </p>
      {open && (
        <div className="table-scroll" style={{ marginTop: 14 }}>
          <table className="inv-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th style={{ textAlign: 'right' }}>Buyers</th>
                <th style={{ textAlign: 'right' }}>Last skipped</th>
              </tr>
            </thead>
            <tbody>
              {skipped.map((s) => (
                <tr key={`${s.campaignId}-${s.at}`}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                    {s.campaignName ?? s.campaignId}
                  </td>
                  <td style={{ textAlign: 'right' }}>{s.buyerCount}</td>
                  <td style={{ textAlign: 'right', color: 'var(--fg2)' }}>
                    {formatRelative(s.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
      <div className="screen-page">
        <div className="page-head">
          <div>
            <h1 className="ahead-title">Integrations</h1>
            <p className="ahead-sub">Live status of every connected service</p>
          </div>
        </div>
        <div className="intg-grid">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="card acard" style={{ minHeight: 240 }} />
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
          // OCT-45: avoid surfacing exact env-var names or the hosting platform
          // to operator UI — the implementation hint belongs in server logs,
          // not in a screenshot-prone integrations card.
          return 'Xero rejected the credentials — verify the Custom Connection client ID and secret in the Xero developer portal match the values in the server configuration.';
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
        iconTint: 'blue' as const,
        status,
        metricLabel: 'ORGANISATION',
        metricValue: data.xero.tenantName ?? (data.xero.configured ? 'Auth pending' : '—'),
        metricSize: 'big' as const,
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
      iconTint: 'orange',
      status: statusFor(data.leadbyte.configured, data.leadbyte.configured),
      metricLabel: 'LEADS THIS MONTH',
      metricValue: data.leadbyte.leadsThisMonth.toLocaleString(),
      lastSyncAt: data.leadbyte.lastSyncAt,
      primaryAction: { label: 'Sync now', icon: RefreshCw, onClick: syncLeadByteNow },
    },
    {
      key: 'catchr',
      title: 'Catchr',
      description: 'Multi-platform ad-spend aggregation',
      icon: Megaphone,
      iconTint: 'blue',
      // Card flips to "Mock" the moment the Catchr probe fails (expired
      // token, transient outage, zero connected platforms). The detail
      // line surfaces the actual error code so the operator doesn't have
      // to grep server logs — same self-diagnostic pattern as Xero.
      status: statusFor(data.catchr.configured, data.catchr.connected),
      metricLabel: 'AD SPEND · LAST 30 DAYS',
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
      iconTint: 'green',
      status: statusFor(data.signnow.configured, data.signnow.configured && !data.signnow.sandbox),
      metricLabel: 'AGREEMENTS SENT',
      metricValue: data.signnow.agreementCount.toLocaleString(),
      detail: data.signnow.sandbox ? 'Sandbox mode — switch to production URL' : 'Production',
      secondaryAction: { label: 'View agreements', href: '/agreements' },
    },
    {
      key: 'r2',
      title: 'Cloudflare R2',
      description: 'File storage · creatives, agreements, invoices',
      icon: HardDrive,
      iconTint: 'orange',
      status: statusFor(data.r2.configured, data.r2.configured),
      metricLabel: 'FILES STORED',
      metricValue: data.r2.fileCount.toLocaleString(),
      detail: data.r2.bucket ?? '—',
    },
    {
      key: 'creditCheck',
      title: 'Credit checks',
      description: data.creditCheck.provider === 'mock' ? 'No provider configured' : `Powered by ${data.creditCheck.provider === 'creditsafe' ? 'Creditsafe' : 'Endole'}`,
      icon: ShieldCheck,
      iconTint: 'purple',
      status: statusFor(true, data.creditCheck.configured && !data.creditCheck.sandbox),
      metricLabel: 'CHECKS RUN',
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
      iconTint: 'purple',
      status: statusFor(data.resend.configured, data.resend.configured),
      metricLabel: 'SENDER',
      metricValue: data.resend.fromEmail ?? '—',
      // Email addresses don't fit the at-a-glance big-number treatment; demote
      // below the integration title so the hierarchy reads name → status → addr.
      metricSize: 'med',
      detail: data.resend.fromEmail?.includes('resend.dev')
        ? 'Pending GoDaddy DNS to switch to verified domain'
        : 'Domain verified',
    },
    // Sam-Loom (jam-video #10) — "AI suggestions, not configure for the
    // environment". Until now this was a silent failure inside the new-task
    // flow; promoting it to a card so the missing env key is obvious from
    // the same place every other integration's health is read.
    {
      key: 'anthropic',
      title: 'AI suggestions',
      description: 'Powers the AI new-task button',
      icon: Sparkles,
      iconTint: 'orange',
      status: statusFor(data.anthropic?.configured ?? false, data.anthropic?.configured ?? false),
      metricLabel: 'STATUS',
      metricValue: data.anthropic?.configured ? 'Configured' : 'Not configured',
      metricSize: 'med',
      detail: data.anthropic?.configured
        ? 'Anthropic API key wired up — task suggestions live.'
        : 'Server is missing the Anthropic API key. Ask your administrator to add it to the backend configuration.',
    },
  ];

  const liveCount = cards.filter((c) => c.status === 'live').length;
  const mockCount = cards.filter((c) => c.status === 'mock').length;
  const notConfiguredCount = cards.filter((c) => c.status === 'not_configured').length;

  const summary = [
    { value: liveCount, label: 'Live', icon: CheckCircle2, tint: 'pos' },
    { value: mockCount, label: 'Degraded / probe failed', icon: AlertCircle, tint: 'warn' },
    { value: notConfiguredCount, label: 'Not configured', icon: XCircle, tint: 'muted' },
  ];

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Integrations</h1>
          <p className="ahead-sub">Live status of every connected service. Click any card to drill in.</p>
        </div>
        <div className="page-actions">
          <button className="btn b-ghost b-sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'size-[15px] animate-spin' : 'size-[15px]'} />
            Refresh
          </button>
        </div>
      </div>

      <div className="intg-summary">
        {summary.map((s) => {
          const SIcon = s.icon;
          return (
            <div key={s.label} className="card acard intg-sum">
              <div>
                <div className="intg-sum-v">{s.value}</div>
                <div className="intg-sum-l">{s.label}</div>
              </div>
              <span className={`intg-sum-ic ${s.tint}`}><SIcon className="size-[22px]" /></span>
            </div>
          );
        })}
      </div>

      <div className="intg-grid">
        {cards.map((spec) => (
          <button
            key={spec.key}
            type="button"
            className="card intg-card"
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
