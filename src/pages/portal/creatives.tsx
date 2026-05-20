import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Image as ImageIcon, Video, FileText, Check, X, RefreshCcw, Loader2, ExternalLink,
} from 'lucide-react';
import {
  usePortalCreatives, useApproveCreative, useRejectCreative, useRequestChangesCreative,
  type PortalReviewCreative,
} from '@/lib/hooks/use-portal';
import { fetchFreshDownloadUrl } from '@/lib/hooks/use-uploads';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from 'sonner';

// Sam #9/#11 — 2026-05-17 confirm. Buyer-facing review tab. Two cards
// rendered side-by-side: "Media" (image/video) and "Copy & landing page".
// Each asset is approve / reject / request-changes; the latter two need
// a comment. Audit trail (IP+UA+user+timestamp) captured server-side.

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadge(status: PortalReviewCreative['approval']['status']) {
  switch (status) {
    case 'approved':
      return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs">Approved</Badge>;
    case 'rejected':
      return <Badge className="bg-red-500/10 text-red-700 border-red-200 text-xs">Rejected</Badge>;
    case 'changes_requested':
      return <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-xs">Changes requested</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">Pending review</Badge>;
  }
}

function iconFor(type: string) {
  if (type === 'image') return ImageIcon;
  if (type === 'video') return Video;
  return FileText;
}

function CreativeRow({ creative }: { creative: PortalReviewCreative }) {
  const approve = useApproveCreative();
  const reject = useRejectCreative();
  const requestChanges = useRequestChangesCreative();

  const [dialog, setDialog] = useState<null | 'reject' | 'changes'>(null);
  const [comment, setComment] = useState('');

  const Icon = iconFor(creative.type);
  const status = creative.approval.status;
  const isDecided = status !== 'pending';

  const handleView = async () => {
    try {
      // For URL-based assets (copy_lp landing pages), open directly. For
      // R2-backed images/videos the fileUrl is a signed URL which may have
      // expired — refresh it via the presigned-URL endpoint.
      if (creative.type === 'text' || creative.fileUrl.startsWith('http')) {
        // R2 keys live under the 'misc' folder per the upload flow. If the
        // fileUrl is already a public URL just open it.
        window.open(creative.fileUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      const url = await fetchFreshDownloadUrl('misc', creative.fileUrl);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Could not generate a fresh link for this asset');
    }
  };

  const submitDecision = async (action: 'reject' | 'changes') => {
    const text = comment.trim();
    if (!text) {
      toast.error('Please add a comment so the team knows what to address');
      return;
    }
    try {
      if (action === 'reject') {
        await reject.mutateAsync({ creativeId: creative.id, feedback: text });
        toast.success('Rejection sent to the team');
      } else {
        await requestChanges.mutateAsync({ creativeId: creative.id, feedback: text });
        toast.success('Changes requested — the team will revise + re-upload');
      }
      setDialog(null);
      setComment('');
    } catch {
      toast.error('Could not save your decision — try again');
    }
  };

  const handleApprove = async () => {
    try {
      await approve.mutateAsync({ creativeId: creative.id });
      toast.success(`${creative.name} approved`);
    } catch {
      toast.error('Could not save your approval — try again');
    }
  };

  const busy = approve.isPending || reject.isPending || requestChanges.isPending;

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
          {statusBadge(status)}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {creative.campaignName} · Uploaded {formatDate(creative.uploadedAt)}
        </p>
        {creative.approval.feedback && (
          <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
            <span className="font-medium">{creative.approval.decidedByName ?? 'You'} said:</span>{' '}
            {creative.approval.feedback}
          </p>
        )}
      </div>
      {/* T3 (Sam, 2026-05-20): action buttons stack + go full-width below sm
          so all three (Approve / Changes / Reject) are reachable from the
          phone thumb-grip without horizontal overflow. Above sm they
          revert to the compact inline trio. */}
      <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:gap-1.5 sm:shrink-0">
        {isDecided ? (
          // Re-decide path — once a decision is made the buyer can still change
          // their mind. New rows append to the audit log; old ones are kept.
          <span className="text-xs text-muted-foreground italic sm:mr-2">
            Decided {creative.approval.decidedAt ? formatDate(creative.approval.decidedAt) : ''}
          </span>
        ) : null}
        <Button
          variant={status === 'approved' ? 'default' : 'outline'}
          onClick={handleApprove}
          disabled={busy}
          className="gap-1.5 h-11 w-full sm:h-9 sm:w-auto"
        >
          {approve.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Approve
        </Button>
        <Button
          variant="outline"
          onClick={() => { setDialog('changes'); setComment(creative.approval.feedback ?? ''); }}
          disabled={busy}
          className="gap-1.5 h-11 w-full sm:h-9 sm:w-auto"
        >
          <RefreshCcw className="size-3.5" />
          Changes
        </Button>
        <Button
          variant="outline"
          onClick={() => { setDialog('reject'); setComment(creative.approval.feedback ?? ''); }}
          disabled={busy}
          className="gap-1.5 h-11 w-full sm:h-9 sm:w-auto text-red-600 hover:text-red-700"
        >
          <X className="size-3.5" />
          Reject
        </Button>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) { setDialog(null); setComment(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === 'reject' ? 'Reject this asset' : 'Request changes'}</DialogTitle>
            <DialogDescription>
              {dialog === 'reject'
                ? 'Tell the team why this asset cannot run. They will revise + re-upload, or remove it entirely.'
                : 'Describe what should change. The team will edit and re-upload a new version.'}
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. The headline needs to mention the 30-day guarantee."
            autoFocus
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="ghost"
              onClick={() => { setDialog(null); setComment(''); }}
              disabled={busy}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant={dialog === 'reject' ? 'destructive' : 'default'}
              onClick={() => dialog && submitDecision(dialog)}
              disabled={busy || comment.trim().length === 0}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              {busy ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
              {dialog === 'reject' ? 'Send rejection' : 'Request changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionCard({
  title, description, creatives, emptyHint,
}: {
  title: string;
  description: string;
  creatives: PortalReviewCreative[];
  emptyHint: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description} · {creatives.length} {creatives.length === 1 ? 'asset' : 'assets'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {creatives.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nothing to review yet"
            description={emptyHint}
          />
        ) : (
          <div className="space-y-3">
            {creatives.map((c) => <CreativeRow key={c.id} creative={c} />)}
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

  const media = data?.media ?? [];
  const copyLp = data?.copyLp ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Creative review</h1>
        <p className="text-muted-foreground">
          Sign off on the ads + landing pages running on your campaigns. Approve, reject, or
          request changes — every decision is logged with a timestamp.
        </p>
      </div>

      <SectionCard
        title="Media"
        description="Image + video ad creatives"
        creatives={media}
        emptyHint="When the team uploads image or video creatives for your campaigns, they will appear here for sign-off."
      />

      <SectionCard
        title="Copy & landing pages"
        description="Ad copy snippets + landing page URLs"
        creatives={copyLp}
        emptyHint="When the team uploads ad copy or links a landing page, it will appear here for sign-off."
      />
    </div>
  );
}
