import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Image as ImageIcon, Video, FileText, ExternalLink } from 'lucide-react';
import {
  usePortalCreatives,
  type PortalReviewCreative,
} from '@/lib/hooks/use-portal';
import { fetchFreshDownloadUrl } from '@/lib/hooks/use-uploads';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';

// Sam (2026-05-27 jam-video #2): "these are just the creatives that have
// been made, they've been accepted, they don't need to approve changes,
// they've been accepted, these are the ones that have been done." The
// /portal/creatives tab is display-only — Approve / Reject / Request
// Changes live only on /portal/compliance.

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function iconFor(type: string) {
  if (type === 'image') return ImageIcon;
  if (type === 'video') return Video;
  return FileText;
}

function CreativeRow({ creative }: { creative: PortalReviewCreative }) {
  const Icon = iconFor(creative.type);

  const handleView = async () => {
    try {
      // Prefer r2Key for ALL types — image/video/text creatives are all
      // R2-stored and their fileUrl is the stale upload-time presigned URL.
      // (Don't shortcut on type === 'text': text creatives also store a file
      // in R2 and need the same fresh-URL flow.) Fall back to fileUrl only
      // when r2Key is null — legacy rows or genuine external links pasted
      // into fileUrl.
      if (creative.r2Key) {
        const url = await fetchFreshDownloadUrl('creatives', creative.r2Key);
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      window.open(creative.fileUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Could not generate a fresh link for this asset');
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleView}
            className="text-sm font-medium underline-offset-2 hover:underline truncate text-left"
            title="Open asset in new tab"
          >
            {creative.name}
          </button>
          <ExternalLink className="size-3 text-muted-foreground" />
          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs">
            Approved
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {creative.campaignName} · Uploaded {formatDate(creative.uploadedAt)}
          {creative.approval.decidedAt && (
            <> · Approved {formatDate(creative.approval.decidedAt)}</>
          )}
        </p>
      </div>
    </div>
  );
}

function folderKey(c: PortalReviewCreative): string {
  const iso = c.approval.decidedAt ?? c.uploadedAt;
  return iso.slice(0, 10);
}

function groupByApprovalDate(creatives: PortalReviewCreative[]): Array<{ date: string; items: PortalReviewCreative[] }> {
  const buckets = new Map<string, PortalReviewCreative[]>();
  for (const c of creatives) {
    const k = folderKey(c);
    const list = buckets.get(k) ?? [];
    list.push(c);
    buckets.set(k, list);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }));
}

function FolderSection({ title, groups, emptyHint }: {
  title: string;
  groups: Array<{ date: string; items: PortalReviewCreative[] }>;
  emptyHint: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {groups.reduce((n, g) => n + g.items.length, 0)}{' '}
          approved asset{groups.reduce((n, g) => n + g.items.length, 0) === 1 ? '' : 's'}
          {' · grouped by approval date'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <EmptyState icon={FileText} title="Nothing here yet" description={emptyHint} />
        ) : (
          <div className="space-y-6">
            {groups.map(({ date, items }) => (
              <div key={date} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  <span className="ml-2 text-xs font-normal text-muted-foreground/80">
                    · {items.length} asset{items.length === 1 ? '' : 's'}
                  </span>
                </h3>
                <div className="space-y-3 pl-2 border-l-2 border-muted">
                  {items.map((c) => <CreativeRow key={c.id} creative={c} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PortalCreativesPage() {
  const { data, isLoading } = usePortalCreatives();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const approvedMedia = (data?.media ?? []).filter((c) => c.approval.status === 'approved');
  const approvedCopyLp = (data?.copyLp ?? []).filter((c) => c.approval.status === 'approved');

  const mediaGroups = groupByApprovalDate(approvedMedia);
  const copyLpGroups = groupByApprovalDate(approvedCopyLp);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Creatives</h1>
        <p className="text-muted-foreground">
          Approved assets currently running on your campaigns, grouped by the day they were
          approved. Items still awaiting review live on the{' '}
          <strong>Compliance</strong> tab.
        </p>
      </div>

      <FolderSection
        title="Media"
        groups={mediaGroups}
        emptyHint="Image and video creatives appear here once they're approved on the Compliance tab."
      />

      <FolderSection
        title="Copy & landing pages"
        groups={copyLpGroups}
        emptyHint="Ad copy snippets and landing page URLs appear here once they're approved on the Compliance tab."
      />
    </div>
  );
}
