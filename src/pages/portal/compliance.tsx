import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Image, Globe, ExternalLink, Shield, AlertTriangle } from 'lucide-react';
import {
  usePortalCompliance,
  type CreativeApprovalState,
  type PortalCreative,
} from '@/lib/hooks/use-portal';
import { EmptyState } from '@/components/shared/empty-state';
import {
  CreativeListItem,
  type CreativeListItemData,
} from '@/components/portal/creative-list-item';
import {
  CreativeDetailPanel,
  type CreativeDetailData,
  type CampaignMetrics,
} from '@/components/portal/creative-detail-panel';
import type { PortalCreativeCampaignMetrics } from '@/lib/hooks/use-portal';
import { usePageTitle } from '@/lib/hooks/use-page-title';

function adaptMetrics(m: PortalCreativeCampaignMetrics | null | undefined): CampaignMetrics | null | undefined {
  if (m === undefined) return undefined;
  if (m === null) return null;
  const windowDays = Math.max(
    1,
    Math.round((new Date(m.windowTo).getTime() - new Date(m.windowFrom).getTime()) / 86_400_000) + 1,
  );
  return {
    windowDays,
    spend: m.spend,
    spendCurrency: m.spendCurrency,
    validLeads: m.validLeads,
    costPerLead: m.costPerLead,
    notes: m.notes,
  };
}

function compactMetricsLine(m: PortalCreativeCampaignMetrics | null | undefined): string | null {
  if (!m) return null;
  const money = (() => {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: m.spendCurrency, maximumFractionDigits: 0 }).format(m.spend);
    } catch {
      return `${m.spendCurrency} ${m.spend.toFixed(0)}`;
    }
  })();
  return `${money} · ${m.validLeads.toLocaleString('en-GB')} leads`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const PENDING_APPROVAL: CreativeApprovalState = {
  status: 'pending',
  decidedAt: null,
  decidedByName: null,
  feedback: null,
};

interface FlatRow {
  creative: PortalCreative;
  campaignName: string;
}

function toListItem(row: FlatRow): CreativeListItemData {
  return {
    id: row.creative.id,
    name: row.creative.name,
    type: row.creative.type,
    uploadedAt: row.creative.uploadedAt,
    campaignName: row.campaignName,
    signedUrl: row.creative.signedUrl,
    approval: row.creative.approval ?? PENDING_APPROVAL,
  };
}

function toDetail(row: FlatRow): CreativeDetailData {
  return {
    id: row.creative.id,
    name: row.creative.name,
    type: row.creative.type,
    uploadedAt: row.creative.uploadedAt,
    campaignName: row.campaignName,
    signedUrl: row.creative.signedUrl,
    fileUrl: row.creative.fileUrl,
    approval: row.creative.approval ?? PENDING_APPROVAL,
  };
}

export function PortalCompliancePage() {
  usePageTitle('Stato — Compliance');
  const { data: compliance, isLoading } = usePortalCompliance();

  // Sam (jam-video #3, 29-May-2026): flatten creatives across campaigns into
  // one side-panel layout. Campaign name shows on each row + in the detail
  // panel header. Approved items live on /portal/creatives — Compliance is
  // for items still awaiting a decision.
  const reviewable: FlatRow[] = useMemo(() => {
    return (compliance ?? []).flatMap((c) =>
      c.creatives
        .filter((cr) => (cr.approval?.status ?? 'pending') !== 'approved')
        .map((cr) => ({ creative: cr, campaignName: c.campaignName })),
    );
  }, [compliance]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select the first reviewable creative once data loads. Re-runs only
  // when the set of reviewable IDs changes so user selection isn't clobbered
  // on every refetch.
  useEffect(() => {
    if (reviewable.length === 0) return;
    const stillExists = selectedId && reviewable.some((r) => r.creative.id === selectedId);
    if (!stillExists) setSelectedId(reviewable[0].creative.id);
  }, [reviewable, selectedId]);

  if (isLoading) {
    return <div className="screen"><Skeleton className="h-[420px] rounded-3xl" /></div>;
  }

  const allCreatives = (compliance ?? []).flatMap((c) => c.creatives);
  const pendingCount = allCreatives.filter((c) => (c.approval?.status ?? 'pending') === 'pending').length;
  const approvedCount = allCreatives.filter((c) => c.approval?.status === 'approved').length;
  const rejectedCount = allCreatives.filter((c) => c.approval?.status === 'rejected').length;

  const selectedRow = reviewable.find((r) => r.creative.id === selectedId) ?? null;

  return (
    <div className="screen">
      {pendingCount > 0 && (
        <div className="edit-hint" style={{ color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)' }}>
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <strong>{pendingCount} creative{pendingCount === 1 ? '' : 's'} need your review.</strong>{' '}
            Each decision is timestamped with your IP address as a record of approval.
          </div>
        </div>
      )}

      {!compliance?.length && (
        <div className="card pad">
          <EmptyState
            icon={Shield}
            title="No compliance assets yet"
            description="Creatives and landing pages used in your campaigns will appear here once uploaded by the team."
          />
        </div>
      )}

      {compliance && compliance.length > 0 && (
        <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { v: pendingCount, l: 'Pending review', c: 'var(--warning)' },
            { v: approvedCount, l: 'Approved', c: 'var(--positive)' },
            { v: rejectedCount, l: 'Rejected', c: 'var(--negative)' },
          ].map((s) => (
            <div className="pstat" key={s.l} style={{ minHeight: 132 }}>
              <div className="pstat-val mono" style={{ color: s.c }}>{s.v}</div>
              <div className="pstat-lab">{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sam (jam-video #3, 29-May-2026) — list on the left scrolls, detail
          panel on the right is sticky on md+ so a buyer can compare adjacent
          assets without losing the panel. */}
      {reviewable.length > 0 && (
        <div className="card pad">
          <h3 className="statto-title" style={{ marginBottom: 4 }}>Open compliance items</h3>
          <p className="lc-sub" style={{ marginBottom: 16 }}>
            {reviewable.length} item{reviewable.length === 1 ? '' : 's'} across {compliance?.length ?? 0} campaign{(compliance?.length ?? 0) === 1 ? '' : 's'}
          </p>
          <div className="grid gap-4 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
            <div className="space-y-2 md:max-h-[70vh] md:overflow-y-auto md:pr-1">
              {reviewable.map((row) => (
                <CreativeListItem
                  key={row.creative.id}
                  item={toListItem(row)}
                  selected={selectedId === row.creative.id}
                  onSelect={() => setSelectedId(row.creative.id)}
                  metricsLine={compactMetricsLine(row.creative.campaignMetrics)}
                />
              ))}
            </div>
            <div className="md:sticky md:top-4 md:self-start">
              {selectedRow ? (
                <CreativeDetailPanel
                  key={selectedRow.creative.id}
                  creative={toDetail(selectedRow)}
                  showDecisionControls
                  metrics={adaptMetrics(selectedRow.creative.campaignMetrics)}
                />
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Select a creative to review it here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Landing pages — kept per-campaign. */}
      {compliance?.map((campaign) => (
        campaign.landingPages.length > 0 ? (
          <div className="card pad" key={campaign.campaignName}>
            <h3 className="statto-title" style={{ marginBottom: 4 }}>Landing pages · {campaign.campaignName}</h3>
            <p className="lc-sub" style={{ marginBottom: 16 }}>{campaign.landingPages.length} page{campaign.landingPages.length !== 1 ? 's' : ''}</p>
            <div className="comp-list">
              {campaign.landingPages.map((lp) => {
                const isSafeUrl = typeof lp.url === 'string' && (lp.url.startsWith('http://') || lp.url.startsWith('https://'));
                return (
                  <div key={lp.id} className="comp-item" style={{ cursor: 'default' }}>
                    <span className="comp-ic2 ok"><Globe className="size-[19px]" /></span>
                    <div className="comp-meta">
                      <span className="comp-l" style={{ wordBreak: 'break-all' }}>{lp.url}</span>
                      <span className="comp-s">Last checked {formatDate(lp.lastChecked)}</span>
                    </div>
                    {isSafeUrl ? (
                      <a href={lp.url} target="_blank" rel="noopener noreferrer" className="link-btn"><ExternalLink className="size-4" /></a>
                    ) : (
                      <span className="comp-s" title="Link not shown — URL did not pass safety check">(link hidden)</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null
      ))}

      {reviewable.length === 0 && compliance && compliance.length > 0 && (
        <div className="card pad">
          <EmptyState
            icon={Image}
            title="All clear"
            description="Nothing awaiting your review right now. Approved items live on the Creatives tab."
          />
        </div>
      )}
    </div>
  );
}
