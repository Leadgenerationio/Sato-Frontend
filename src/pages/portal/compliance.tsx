import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Image, Video, FileText, Globe, ExternalLink, Shield, Check, X, Clock, AlertTriangle } from 'lucide-react';
import {
  usePortalCompliance,
  useApproveCreative,
  useRejectCreative,
  type CreativeApprovalStatus,
  type CreativeApprovalState,
  type PortalCreative,
} from '@/lib/hooks/use-portal';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';

const typeIcons: Record<string, React.ElementType> = {
  image: Image,
  video: Video,
  text: FileText,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: CreativeApprovalStatus }) {
  if (status === 'approved') {
    return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200"><Check className="size-3 mr-1" />Approved</Badge>;
  }
  if (status === 'rejected') {
    return <Badge className="bg-rose-500/10 text-rose-600 border-rose-200"><X className="size-3 mr-1" />Rejected</Badge>;
  }
  return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="size-3 mr-1" />Pending review</Badge>;
}

const PENDING_APPROVAL: CreativeApprovalState = {
  status: 'pending',
  decidedAt: null,
  decidedByName: null,
  feedback: null,
};

function CreativeRow({ creative, onReject, onPreview }: { creative: PortalCreative; onReject: (creative: PortalCreative) => void; onPreview: (creative: PortalCreative) => void }) {
  const Icon = typeIcons[creative.type] ?? FileText;
  const approve = useApproveCreative();
  const approval = creative.approval ?? PENDING_APPROVAL;

  async function handleApprove() {
    try {
      await approve.mutateAsync({ creativeId: creative.id });
      toast.success('Creative approved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record approval';
      toast.error(message);
    }
  }

  const isPending = approval.status === 'pending';
  // Sam (jam-video #3, 29-May-2026): "you have to open it up in a brand new
  // tab, so it's not very user-friendly". Show inline thumbnails for
  // image/video using the BE-signed URL. Clicking the row opens a preview
  // modal — no more new-tab dance to see what an asset actually is.
  const isImage = creative.type === 'image' && !!creative.signedUrl;
  const isVideo = creative.type === 'video' && !!creative.signedUrl;

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onPreview(creative)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-md hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Open preview"
        >
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
            {isImage ? (
              <img src={creative.signedUrl!} alt={creative.name} className="size-full object-cover" loading="lazy" />
            ) : isVideo ? (
              <video src={creative.signedUrl!} className="size-full object-cover" muted preload="metadata" />
            ) : (
              <Icon className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{creative.name}</p>
            <p className="text-xs text-muted-foreground">
              Uploaded {formatDate(creative.uploadedAt)} · <Badge variant="secondary" className="text-xs capitalize">{creative.type}</Badge>
            </p>
          </div>
        </button>
        <div className="shrink-0 flex items-center gap-2">
          <StatusBadge status={approval.status} />
        </div>
      </div>

      {/* Decision metadata */}
      {approval.status !== 'pending' && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>
            {approval.status === 'approved' ? 'Approved' : 'Rejected'} on{' '}
            {approval.decidedAt && formatDateTime(approval.decidedAt)}
            {approval.decidedByName && ` by ${approval.decidedByName}`}
          </p>
          {approval.feedback && (
            <p className="rounded-md bg-muted/50 p-2 text-foreground">
              <span className="font-medium">Feedback:</span> {approval.feedback}
            </p>
          )}
        </div>
      )}

      {/* Action buttons (pending only). T3 (Sam, 2026-05-20): on mobile
          the buttons stack full-width + use the default 44pt height so
          they're thumb-reachable from the bottom of the viewport; on
          sm+ they revert to side-by-side small buttons. */}
      {isPending && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            onClick={handleApprove}
            disabled={approve.isPending}
            className="h-11 w-full sm:h-9 sm:w-auto"
          >
            <Check className="size-4" />
            Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => onReject(creative)}
            className="h-11 w-full sm:h-9 sm:w-auto"
          >
            <X className="size-4" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

interface RejectDialogState {
  creative: PortalCreative | null;
  feedback: string;
}

export function PortalCompliancePage() {
  const { data: compliance, isLoading } = usePortalCompliance();
  const reject = useRejectCreative();
  const [rejectState, setRejectState] = useState<RejectDialogState>({ creative: null, feedback: '' });
  // Sam jam-video #3: inline preview modal — no more "open in new tab" dance.
  const [previewCreative, setPreviewCreative] = useState<PortalCreative | null>(null);

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>;
  }

  function openRejectFor(creative: PortalCreative) {
    setRejectState({ creative, feedback: '' });
  }

  async function submitReject() {
    if (!rejectState.creative) return;
    const trimmed = rejectState.feedback.trim();
    if (trimmed.length === 0) {
      toast.error('Please tell us what needs to change');
      return;
    }
    try {
      await reject.mutateAsync({ creativeId: rejectState.creative.id, feedback: trimmed });
      toast.success('Creative rejected with feedback');
      setRejectState({ creative: null, feedback: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record rejection';
      toast.error(message);
    }
  }

  // Counts for the headline summary banner — gives the client an at-a-glance
  // sense of what still needs their attention.
  const allCreatives = compliance?.flatMap((c) => c.creatives) ?? [];
  const pendingCount = allCreatives.filter((c) => (c.approval?.status ?? 'pending') === 'pending').length;
  const approvedCount = allCreatives.filter((c) => c.approval?.status === 'approved').length;
  const rejectedCount = allCreatives.filter((c) => c.approval?.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance</h1>
        <p className="text-muted-foreground">Review and approve creatives used in your campaigns</p>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">{pendingCount} creative{pendingCount === 1 ? '' : 's'} need your review</p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300">
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
          <Card className="gap-2 py-4"><CardContent><p className="text-2xl font-bold tabular-nums text-amber-600">{pendingCount}</p><p className="text-xs text-muted-foreground">Pending review</p></CardContent></Card>
          <Card className="gap-2 py-4"><CardContent><p className="text-2xl font-bold tabular-nums text-emerald-600">{approvedCount}</p><p className="text-xs text-muted-foreground">Approved</p></CardContent></Card>
          <Card className="gap-2 py-4"><CardContent><p className="text-2xl font-bold tabular-nums text-rose-600">{rejectedCount}</p><p className="text-xs text-muted-foreground">Rejected</p></CardContent></Card>
        </div>
      )}

      {compliance?.map((campaign) => {
        // Sam (27 May 2026 portal meeting): "creatives should only appear
        // after compliance approval... if they approve will then move
        // into Creatives." Compliance now hides anything already approved
        // — those rows live on the Creatives tab. Rejected + changes_
        // requested stay visible so the client can re-decide if needed.
        const reviewable = campaign.creatives.filter(
          (cr) => (cr.approval?.status ?? 'pending') !== 'approved',
        );
        return (
        <div key={campaign.campaignName} className="space-y-4">
          <h2 className="text-lg font-semibold">{campaign.campaignName}</h2>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Creatives awaiting review</CardTitle>
              <CardDescription>{reviewable.length} creative{reviewable.length !== 1 ? 's' : ''} pending</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviewable.length === 0 ? (
                <EmptyState
                  icon={Image}
                  title="All clear here"
                  description="No creatives are awaiting your review for this campaign. Approved items live on the Creatives tab."
                  size="compact"
                />
              ) : (
                reviewable.map((cr) => (
                  <CreativeRow key={cr.id} creative={cr} onReject={openRejectFor} onPreview={setPreviewCreative} />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Landing Pages</CardTitle>
              <CardDescription>{campaign.landingPages.length} page{campaign.landingPages.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaign.landingPages.length === 0 ? (
                <EmptyState
                  icon={Globe}
                  title="No landing pages"
                  description="Landing pages registered for this campaign will appear here."
                  size="compact"
                />
              ) : (
                campaign.landingPages.map((lp) => {
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
                })
              )}
            </CardContent>
          </Card>
        </div>
        );
      })}

      <Dialog open={!!rejectState.creative} onOpenChange={(open) => { if (!open) setRejectState({ creative: null, feedback: '' }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject creative</DialogTitle>
            <DialogDescription>
              Please tell us what needs to change. The team will see your feedback and revise the asset.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="What needs to change? (e.g. logo too small, wrong call-to-action)"
            value={rejectState.feedback}
            onChange={(e) => setRejectState((s) => ({ ...s, feedback: e.target.value }))}
            autoFocus
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setRejectState({ creative: null, feedback: '' })}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitReject}
              disabled={reject.isPending || rejectState.feedback.trim().length === 0}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              Submit rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sam (jam-video #3, 29-May-2026): inline preview modal — opens
          when the row is clicked. Shows the asset at full size with the
          decision audit log if any, plus the decision buttons. Replaces
          the "open in a new tab" pattern Sam called user-unfriendly. */}
      <Dialog open={!!previewCreative} onOpenChange={(open) => { if (!open) setPreviewCreative(null); }}>
        <DialogContent className="max-w-3xl">
          {previewCreative && (() => {
            const ap = previewCreative.approval ?? PENDING_APPROVAL;
            const isImg = previewCreative.type === 'image' && !!previewCreative.signedUrl;
            const isVid = previewCreative.type === 'video' && !!previewCreative.signedUrl;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="truncate">{previewCreative.name}</DialogTitle>
                  <DialogDescription>
                    Uploaded {formatDate(previewCreative.uploadedAt)} · <span className="capitalize">{previewCreative.type}</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-center bg-muted rounded-md min-h-[320px] max-h-[60vh] overflow-hidden">
                  {isImg ? (
                    <img src={previewCreative.signedUrl!} alt={previewCreative.name} className="max-h-[60vh] w-auto object-contain" />
                  ) : isVid ? (
                    <video src={previewCreative.signedUrl!} className="max-h-[60vh] w-auto" controls autoPlay muted />
                  ) : previewCreative.signedUrl || previewCreative.fileUrl ? (
                    <a
                      href={previewCreative.signedUrl ?? previewCreative.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 underline"
                    >
                      Open {previewCreative.name} ↗
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">No preview available</p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={ap.status} />
                    {ap.status !== 'pending' && ap.decidedAt && (
                      <span>
                        on {formatDateTime(ap.decidedAt)}
                        {ap.decidedByName && ` by ${ap.decidedByName}`}
                      </span>
                    )}
                  </div>
                  {ap.feedback && (
                    <p className="rounded-md bg-muted/50 p-2 text-foreground">
                      <span className="font-medium">Feedback:</span> {ap.feedback}
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
