import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Image, Globe, ExternalLink, Shield, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
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
import { groupIntoBatches } from '@/lib/portal-batches';

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

// FIX 2 (2026-06-15): Compliance defaults to "Pending Review" — items needing
// a decision. `changes_requested` is treated as pending/needs-action (the safe
// default the client asked for). Selecting a tab filters the list to that
// bucket; Pending Review is blank when nothing is awaiting a decision.
type ComplianceTab = 'pending' | 'approved' | 'rejected';

const COMPLIANCE_TABS: { value: ComplianceTab; label: string }[] = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function statusOf(cr: PortalCreative): CreativeApprovalState['status'] {
  return cr.approval?.status ?? 'pending';
}

function matchesTab(cr: PortalCreative, tab: ComplianceTab): boolean {
  const s = statusOf(cr);
  if (tab === 'approved') return s === 'approved';
  if (tab === 'rejected') return s === 'rejected';
  // Pending bucket = pending + changes_requested (needs-action).
  return s === 'pending' || s === 'changes_requested';
}

// FIX 3 (2026-06-15, client asked 3×): group creatives into dated BATCHES by
// submission/upload day. PortalCreative carries `uploadedAt`; bucket on that.
// Batching helpers live in @/lib/portal-batches and are shared with the
// Creatives tab.

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

  // FIX 2 (2026-06-15): default landing tab = Pending Review.
  const [activeTab, setActiveTab] = useState<ComplianceTab>('pending');

  // Flatten creatives across campaigns into one side-panel layout, then filter
  // to the active status tab. Campaign name shows on each row + in the detail
  // panel header.
  const allRows: FlatRow[] = useMemo(() => {
    return (compliance ?? []).flatMap((c) =>
      c.creatives.map((cr) => ({ creative: cr, campaignName: c.campaignName })),
    );
  }, [compliance]);

  const visibleRows: FlatRow[] = useMemo(
    () => allRows.filter((r) => matchesTab(r.creative, activeTab)),
    [allRows, activeTab],
  );

  // FIX 3 (2026-06-15): within the active tab, group rows into dated batches.
  const batches = useMemo(
    () => groupIntoBatches(visibleRows, (r) => r.creative.uploadedAt),
    [visibleRows],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Track which batches are collapsed; default is expanded (only collapsed
  // batches are stored, so newly-appearing batches show open).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Auto-select the first visible creative once data loads / tab changes.
  // Re-runs only when the set of visible IDs changes so user selection isn't
  // clobbered on every refetch.
  useEffect(() => {
    if (visibleRows.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    const stillExists = selectedId && visibleRows.some((r) => r.creative.id === selectedId);
    if (!stillExists) setSelectedId(visibleRows[0].creative.id);
  }, [visibleRows, selectedId]);

  if (isLoading) {
    return <div className="screen"><Skeleton className="h-[420px] rounded-3xl" /></div>;
  }

  const allCreatives = (compliance ?? []).flatMap((c) => c.creatives);
  const pendingCount = allCreatives.filter((c) => statusOf(c) === 'pending' || statusOf(c) === 'changes_requested').length;
  const approvedCount = allCreatives.filter((c) => statusOf(c) === 'approved').length;
  const rejectedCount = allCreatives.filter((c) => statusOf(c) === 'rejected').length;
  const tabCount: Record<ComplianceTab, number> = { pending: pendingCount, approved: approvedCount, rejected: rejectedCount };

  const selectedRow = visibleRows.find((r) => r.creative.id === selectedId) ?? null;

  const toggleBatch = (dayKey: string) =>
    setCollapsed((prev) => ({ ...prev, [dayKey]: !prev[dayKey] }));

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

      {/* FIX 2 (2026-06-15): clickable status tabs / stat cards. The three
          stat cards double as the filter tabs (Pending Review | Approved |
          Rejected); the selected one is outlined. Default = Pending Review. */}
      {compliance && compliance.length > 0 && (
        <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }} role="tablist" aria-label="Compliance status filter">
          {COMPLIANCE_TABS.map((t) => {
            const color = t.value === 'pending' ? 'var(--warning)' : t.value === 'approved' ? 'var(--positive)' : 'var(--negative)';
            const isActive = activeTab === t.value;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className="pstat"
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                style={{
                  minHeight: 132,
                  cursor: 'pointer',
                  textAlign: 'left',
                  outline: isActive ? '2px solid var(--statto-ink)' : '1px solid var(--border)',
                  outlineOffset: isActive ? '-2px' : '-1px',
                }}
              >
                <div className="pstat-val mono" style={{ color }}>{tabCount[t.value]}</div>
                <div className="pstat-lab">{t.label}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* List (grouped into dated batches) on the left scrolls; detail panel on
          the right is sticky on md+ so a buyer can compare adjacent assets. */}
      {compliance && compliance.length > 0 && visibleRows.length > 0 && (
        <div className="card pad">
          <h3 className="statto-title" style={{ marginBottom: 4 }}>
            {COMPLIANCE_TABS.find((t) => t.value === activeTab)?.label}
          </h3>
          <p className="lc-sub" style={{ marginBottom: 16 }}>
            {visibleRows.length} item{visibleRows.length === 1 ? '' : 's'} in {batches.length} batch{batches.length === 1 ? '' : 'es'}
          </p>
          <div className="grid gap-4 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
            <div className="space-y-3 md:max-h-[70vh] md:overflow-y-auto md:pr-1">
              {/* FIX 3: each batch is a collapsible section keyed by upload day. */}
              {batches.map((batch) => {
                const isCollapsed = collapsed[batch.dayKey] ?? false;
                return (
                  <div key={batch.dayKey}>
                    <button
                      type="button"
                      onClick={() => toggleBatch(batch.dayKey)}
                      aria-expanded={!isCollapsed}
                      className="comp-batch-head"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer',
                        font: 'inherit', color: 'inherit', textAlign: 'left',
                      }}
                    >
                      {isCollapsed ? <ChevronRight className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
                      <span className="cc-name" style={{ fontWeight: 600 }}>{batch.label}</span>
                      <span className="cc-fmt" style={{ marginLeft: 'auto' }}>
                        {batch.items.length} item{batch.items.length === 1 ? '' : 's'}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-2" style={{ marginTop: 4 }}>
                        {batch.items.map((row) => (
                          <CreativeListItem
                            key={row.creative.id}
                            item={toListItem(row)}
                            selected={selectedId === row.creative.id}
                            onSelect={() => setSelectedId(row.creative.id)}
                            metricsLine={compactMetricsLine(row.creative.campaignMetrics)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
                <div className="dash-empty">
                  Select a creative to review it here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state for the active tab (e.g. blank Pending Review). */}
      {compliance && compliance.length > 0 && visibleRows.length === 0 && (
        <div className="card pad">
          <EmptyState
            icon={Image}
            title={
              activeTab === 'pending' ? 'Nothing pending review'
                : activeTab === 'approved' ? 'No approved items'
                  : 'No rejected items'
            }
            description={
              activeTab === 'pending'
                ? 'Nothing is awaiting your review right now.'
                : `No ${activeTab} creatives to show.`
            }
          />
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
    </div>
  );
}
