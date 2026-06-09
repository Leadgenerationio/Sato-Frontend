import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>;
  }

  const allCreatives = (compliance ?? []).flatMap((c) => c.creatives);
  const pendingCount = allCreatives.filter((c) => (c.approval?.status ?? 'pending') === 'pending').length;
  const approvedCount = allCreatives.filter((c) => c.approval?.status === 'approved').length;
  const rejectedCount = allCreatives.filter((c) => c.approval?.status === 'rejected').length;

  const selectedRow = reviewable.find((r) => r.creative.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance</h1>
        <p className="text-muted-foreground">Review and approve creatives used in your campaigns</p>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-warning dark:bg-warning/30 dark:text-warning">
          <AlertTriangle className="size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">{pendingCount} creative{pendingCount === 1 ? '' : 's'} need your review</p>
            <p className="mt-0.5 text-warning dark:text-warning">
              Each decision is timestamped with your IP address as a record of approval.
            </p>
          </div>
        </div>
      )}

      {!compliance?.length && (
        <Card>
          <CardContent>
            <EmptyState
              icon={Shield}
              title="No compliance assets yet"
              description="Creatives and landing pages used in your campaigns will appear here once uploaded by the team."
            />
          </CardContent>
        </Card>
      )}

      {compliance && compliance.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="gap-2 py-4"><CardContent><p className="text-2xl font-bold tabular-nums text-warning">{pendingCount}</p><p className="text-xs text-muted-foreground">Pending review</p></CardContent></Card>
          <Card className="gap-2 py-4"><CardContent><p className="text-2xl font-bold tabular-nums text-positive">{approvedCount}</p><p className="text-xs text-muted-foreground">Approved</p></CardContent></Card>
          <Card className="gap-2 py-4"><CardContent><p className="text-2xl font-bold tabular-nums text-negative">{rejectedCount}</p><p className="text-xs text-muted-foreground">Rejected</p></CardContent></Card>
        </div>
      )}

      {/* Sam (jam-video #3, 29-May-2026) — grid + detail panel. Sam's quote:
          "click in, see all the ads on the right hand side". List on the
          left scrolls, detail panel on the right is sticky on md+ so a buyer
          can compare adjacent assets without losing the panel. */}
      {reviewable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open compliance items</CardTitle>
            <CardDescription>
              {reviewable.length} item{reviewable.length === 1 ? '' : 's'} across {compliance?.length ?? 0} campaign{(compliance?.length ?? 0) === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Landing pages — kept per-campaign because each LP belongs to a
          single campaign and the URL list is small enough that grouping
          adds clarity rather than noise. */}
      {compliance?.map((campaign) => (
        campaign.landingPages.length > 0 ? (
          <Card key={campaign.campaignName}>
            <CardHeader>
              <CardTitle className="text-base">Landing pages · {campaign.campaignName}</CardTitle>
              <CardDescription>{campaign.landingPages.length} page{campaign.landingPages.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaign.landingPages.map((lp) => {
                const isSafeUrl = typeof lp.url === 'string' && (lp.url.startsWith('http://') || lp.url.startsWith('https://'));
                return (
                  <div key={lp.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Globe className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-sm font-medium">{lp.url}</p>
                        <p className="text-xs text-muted-foreground">Last checked {formatDate(lp.lastChecked)}</p>
                      </div>
                    </div>
                    {isSafeUrl ? (
                      <a href={lp.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ExternalLink className="size-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground" title="Link not shown — URL did not pass safety check">
                        (link hidden)
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null
      ))}

      {reviewable.length === 0 && compliance && compliance.length > 0 && (
        <Card>
          <CardContent>
            <EmptyState
              icon={Image}
              title="All clear"
              description="Nothing awaiting your review right now. Approved items live on the Creatives tab."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
