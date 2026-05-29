import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Image as ImageIcon, Video, FileText, ExternalLink } from 'lucide-react';
import {
  fetchPortalCreativeSignedUrl,
  usePortalCreatives,
  type PortalReviewCreative,
} from '@/lib/hooks/use-portal';
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

function CreativeRow({ creative, onPreview }: { creative: PortalReviewCreative; onPreview: (c: PortalReviewCreative) => void }) {
  const Icon = iconFor(creative.type);
  // Sam (jam-video #3, 29-May-2026): inline thumbnails for image/video. Use
  // the BE-signed URL directly so we don't have to lazy-fetch one per row.
  // Falling back to fetching via /signed-url on click for legacy bundles
  // where signedUrl isn't yet present in the API response.
  const isImage = creative.type === 'image' && !!creative.signedUrl;
  const isVideo = creative.type === 'video' && !!creative.signedUrl;

  const handleClick = async () => {
    if (creative.signedUrl) {
      onPreview(creative);
      return;
    }
    // Legacy fallback — BE hasn't redeployed with signedUrl yet.
    try {
      const url = await fetchPortalCreativeSignedUrl(creative.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Could not generate a fresh link for this asset');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:gap-4 text-left w-full hover:bg-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
      title="Open preview"
    >
      <div className="flex size-20 shrink-0 items-center justify-center rounded-md bg-muted overflow-hidden">
        {isImage ? (
          <img src={creative.signedUrl!} alt={creative.name} className="size-full object-cover" loading="lazy" />
        ) : isVideo ? (
          <video src={creative.signedUrl!} className="size-full object-cover" muted preload="metadata" />
        ) : (
          <Icon className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium truncate">{creative.name}</span>
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
        {/* Sam (jam-video #3): "shows you how many to date, who signed them off". */}
        {creative.approval.decidedByName && (
          <p className="mt-1 text-xs text-emerald-700">
            Signed off by <span className="font-medium">{creative.approval.decidedByName}</span>
            {creative.approval.decidedAt && <> · {formatDate(creative.approval.decidedAt)}</>}
          </p>
        )}
      </div>
    </button>
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

function FolderSection({ title, groups, emptyHint, onPreview }: {
  title: string;
  groups: Array<{ date: string; items: PortalReviewCreative[] }>;
  emptyHint: string;
  onPreview: (c: PortalReviewCreative) => void;
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
                  {items.map((c) => <CreativeRow key={c.id} creative={c} onPreview={onPreview} />)}
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
  const [preview, setPreview] = useState<PortalReviewCreative | null>(null);

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
        onPreview={setPreview}
      />

      <FolderSection
        title="Copy & landing pages"
        groups={copyLpGroups}
        emptyHint="Ad copy snippets and landing page URLs appear here once they're approved on the Compliance tab."
        onPreview={setPreview}
      />

      {/* Sam (jam-video #3, 29-May-2026): inline preview modal — full-size
          image/video on click, signed-off attribution prominent. */}
      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-3xl">
          {preview && (() => {
            const isImg = preview.type === 'image' && !!preview.signedUrl;
            const isVid = preview.type === 'video' && !!preview.signedUrl;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="truncate">{preview.name}</DialogTitle>
                  <DialogDescription>
                    {preview.campaignName} · Uploaded {formatDate(preview.uploadedAt)}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-center bg-muted rounded-md min-h-[320px] max-h-[60vh] overflow-hidden">
                  {isImg ? (
                    <img src={preview.signedUrl!} alt={preview.name} className="max-h-[60vh] w-auto object-contain" />
                  ) : isVid ? (
                    <video src={preview.signedUrl!} className="max-h-[60vh] w-auto" controls autoPlay muted />
                  ) : preview.signedUrl || preview.fileUrl ? (
                    <a
                      href={preview.signedUrl ?? preview.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 underline"
                    >
                      Open {preview.name} ↗
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">No preview available</p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs">Approved</Badge>
                    {preview.approval.decidedAt && (
                      <span>on {formatDate(preview.approval.decidedAt)}</span>
                    )}
                    {preview.approval.decidedByName && (
                      <span>by <span className="font-medium text-foreground">{preview.approval.decidedByName}</span></span>
                    )}
                  </p>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
