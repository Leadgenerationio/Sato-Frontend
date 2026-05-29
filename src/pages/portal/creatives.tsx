import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';
import {
  usePortalCreatives,
  type PortalReviewCreative,
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

// Sam (jam-video #2, 27-May-2026): the /portal/creatives tab is display-only.
// These are the assets that have already been approved on /portal/compliance.
// No decision controls here — just the gallery + audit log.

function toListItem(c: PortalReviewCreative): CreativeListItemData {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    uploadedAt: c.uploadedAt,
    campaignName: c.campaignName,
    signedUrl: c.signedUrl,
    approval: c.approval,
  };
}

function toDetail(c: PortalReviewCreative): CreativeDetailData {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    uploadedAt: c.uploadedAt,
    campaignName: c.campaignName,
    signedUrl: c.signedUrl,
    fileUrl: c.fileUrl,
    approval: c.approval,
  };
}

interface SectionProps {
  title: string;
  description: string;
  items: PortalReviewCreative[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyHint: string;
}

function SideBySideSection({ title, description, items, selectedId, onSelect, emptyHint }: SectionProps) {
  const selected = items.find((c) => c.id === selectedId) ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={FileText} title="Nothing here yet" description={emptyHint} size="compact" />
        ) : (
          <div className="grid gap-4 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
            <div className="space-y-2 md:max-h-[70vh] md:overflow-y-auto md:pr-1">
              {items.map((c) => (
                <CreativeListItem
                  key={c.id}
                  item={toListItem(c)}
                  selected={selectedId === c.id}
                  onSelect={() => onSelect(c.id)}
                  metricsLine={compactMetricsLine(c.campaignMetrics)}
                />
              ))}
            </div>
            <div className="md:sticky md:top-4 md:self-start">
              {selected ? (
                <CreativeDetailPanel
                  key={selected.id}
                  creative={toDetail(selected)}
                  showDecisionControls={false}
                  metrics={adaptMetrics(selected.campaignMetrics)}
                />
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Select an asset to view it here.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PortalCreativesPage() {
  const { data, isLoading } = usePortalCreatives();

  const media = useMemo(
    () => (data?.media ?? []).filter((c) => c.approval.status === 'approved'),
    [data?.media],
  );
  const copyLp = useMemo(
    () => (data?.copyLp ?? []).filter((c) => c.approval.status === 'approved'),
    [data?.copyLp],
  );

  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedCopyLpId, setSelectedCopyLpId] = useState<string | null>(null);

  useEffect(() => {
    if (media.length === 0) return;
    const stillExists = selectedMediaId && media.some((c) => c.id === selectedMediaId);
    if (!stillExists) setSelectedMediaId(media[0].id);
  }, [media, selectedMediaId]);

  useEffect(() => {
    if (copyLp.length === 0) return;
    const stillExists = selectedCopyLpId && copyLp.some((c) => c.id === selectedCopyLpId);
    if (!stillExists) setSelectedCopyLpId(copyLp[0].id);
  }, [copyLp, selectedCopyLpId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Creatives</h1>
        <p className="text-muted-foreground">
          Approved assets currently running on your campaigns. Items still awaiting review live on the{' '}
          <strong>Compliance</strong> tab.
        </p>
      </div>

      <SideBySideSection
        title="Media"
        description={`${media.length} approved asset${media.length === 1 ? '' : 's'}`}
        items={media}
        selectedId={selectedMediaId}
        onSelect={setSelectedMediaId}
        emptyHint="Image and video creatives appear here once they're approved on the Compliance tab."
      />

      <SideBySideSection
        title="Copy & landing pages"
        description={`${copyLp.length} approved asset${copyLp.length === 1 ? '' : 's'}`}
        items={copyLp}
        selectedId={selectedCopyLpId}
        onSelect={setSelectedCopyLpId}
        emptyHint="Ad copy snippets and landing page URLs appear here once they're approved on the Compliance tab."
      />
    </div>
  );
}
