import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Image as ImageIcon, Video, FileText, Check, X, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useApproveCreative, useRejectCreative, type CreativeApprovalState } from '@/lib/hooks/use-portal';

// Sam (jam-video #3, 29-May-2026) — right-hand detail panel that fills as the
// buyer clicks each row in the side-panel layout. Pulls the full asset, the
// decision audit, and (Compliance only) the approve / reject controls into
// one place so there is no more "open in new tab" round-trip.

export interface CreativeDetailData {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  campaignName: string | null;
  signedUrl?: string | null;
  fileUrl?: string | null;
  approval: CreativeApprovalState;
}

function iconFor(type: string) {
  if (type === 'image') return ImageIcon;
  if (type === 'video') return Video;
  return FileText;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: CreativeApprovalState['status'] }) {
  if (status === 'approved') {
    return <Badge className="bg-positive-bg text-positive border-positive/30"><Check className="size-3 mr-1" />Approved</Badge>;
  }
  if (status === 'rejected') {
    return <Badge className="bg-negative-bg text-negative border-negative/30"><X className="size-3 mr-1" />Rejected</Badge>;
  }
  if (status === 'changes_requested') {
    return <Badge className="bg-warning-bg text-warning border-warning/30">Changes requested</Badge>;
  }
  return <Badge className="bg-warning-bg text-warning border-warning/30"><Clock className="size-3 mr-1" />Pending review</Badge>;
}

export interface CampaignMetrics {
  windowDays: number;
  spend: number;
  spendCurrency: string;
  validLeads: number;
  costPerLead: number | null;
  /** Why a number is real-zero, surfaced as a tooltip. */
  notes?: { spend?: string; leads?: string };
}

function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

function MetricsCard({ metrics }: { metrics: CampaignMetrics | null }) {
  if (metrics === null) {
    return (
      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5"><AlertCircle className="size-3.5" />Performance data temporarily unavailable.</p>
        </CardContent>
      </Card>
    );
  }
  const cpl = metrics.costPerLead;
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Campaign performance · this month
        </p>
        <div className="grid grid-cols-3 gap-3 tabular-nums">
          <div>
            <p className="text-lg font-semibold">{fmtMoney(metrics.spend, metrics.spendCurrency)}</p>
            <p className="text-[11px] text-muted-foreground" title={metrics.notes?.spend ?? undefined}>
              Spend{metrics.notes?.spend ? ' *' : ''}
            </p>
          </div>
          <div>
            <p className="text-lg font-semibold">{metrics.validLeads.toLocaleString('en-GB')}</p>
            <p className="text-[11px] text-muted-foreground" title={metrics.notes?.leads ?? undefined}>
              Valid leads{metrics.notes?.leads ? ' *' : ''}
            </p>
          </div>
          <div>
            <p className="text-lg font-semibold">{cpl === null ? '—' : fmtMoney(cpl, metrics.spendCurrency)}</p>
            <p className="text-[11px] text-muted-foreground">Cost per lead</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  creative: CreativeDetailData;
  /** When true (Compliance), show Approve/Reject controls for pending rows. */
  showDecisionControls?: boolean;
  /** Optional campaign-performance card (Item 3). null = error; undefined = hide entirely. */
  metrics?: CampaignMetrics | null;
}

export function CreativeDetailPanel({ creative, showDecisionControls = false, metrics }: Props) {
  const approve = useApproveCreative();
  const reject = useRejectCreative();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');

  const ap = creative.approval;
  const isImg = creative.type === 'image' && !!creative.signedUrl;
  const isVid = creative.type === 'video' && !!creative.signedUrl;
  const isPending = ap.status === 'pending';
  const Icon = iconFor(creative.type);

  async function handleApprove() {
    try {
      await approve.mutateAsync({ creativeId: creative.id });
      toast.success(`Approved "${creative.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record approval');
    }
  }

  async function handleSubmitReject() {
    const trimmed = rejectFeedback.trim();
    if (trimmed.length === 0) {
      toast.error('Please tell us what needs to change');
      return;
    }
    try {
      await reject.mutateAsync({ creativeId: creative.id, feedback: trimmed });
      toast.success('Creative rejected with feedback');
      setRejectOpen(false);
      setRejectFeedback('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record rejection');
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{creative.name}</h2>
          <p className="text-xs text-muted-foreground">
            {creative.campaignName ? <>{creative.campaignName} · </> : null}
            Uploaded {formatDate(creative.uploadedAt)} · <span className="capitalize">{creative.type}</span>
          </p>
        </div>
        <StatusBadge status={ap.status} />
      </div>

      {/* Media */}
      <div className="flex items-center justify-center overflow-hidden rounded-lg border bg-muted/40 min-h-[280px] max-h-[60vh]">
        {isImg ? (
          <img src={creative.signedUrl!} alt={creative.name} className="max-h-[60vh] w-auto object-contain" />
        ) : isVid ? (
          <video src={creative.signedUrl!} className="max-h-[60vh] w-auto" controls autoPlay muted />
        ) : creative.signedUrl || creative.fileUrl ? (
          <a
            href={creative.signedUrl ?? creative.fileUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-info underline px-6 py-12"
          >
            Open {creative.name} ↗
          </a>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
            <Icon className="size-8" />
            <p className="text-xs">No preview available</p>
          </div>
        )}
      </div>

      {/* Decision audit */}
      <div className="rounded-lg border p-3 text-sm">
        {ap.status === 'approved' && (
          <p className="text-positive dark:text-positive">
            <Check className="size-4 inline mr-1" />
            Signed off
            {ap.decidedByName && <> by <span className="font-medium">{ap.decidedByName}</span></>}
            {ap.decidedAt && <> on {formatDateTime(ap.decidedAt)}</>}
          </p>
        )}
        {(ap.status === 'rejected' || ap.status === 'changes_requested') && (
          <div className="space-y-2 text-negative dark:text-negative">
            <p>
              <X className="size-4 inline mr-1" />
              {ap.status === 'rejected' ? 'Rejected' : 'Changes requested'}
              {ap.decidedByName && <> by <span className="font-medium">{ap.decidedByName}</span></>}
              {ap.decidedAt && <> on {formatDateTime(ap.decidedAt)}</>}
            </p>
            {ap.feedback && !/^(na|n\/a|none|-|nil)$/i.test(ap.feedback.trim()) && (
              <p className="rounded-md bg-negative-bg dark:bg-negative/30 p-2 text-foreground">
                <span className="font-medium">Feedback:</span> {ap.feedback}
              </p>
            )}
          </div>
        )}
        {isPending && (
          <p className="text-warning dark:text-warning">
            <Clock className="size-4 inline mr-1" />
            Awaiting your review.
            {showDecisionControls && ' Each decision is timestamped with your IP for audit.'}
          </p>
        )}
      </div>

      {/* Decision controls (Compliance only, pending only) */}
      {showDecisionControls && isPending && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleApprove}
            disabled={approve.isPending}
            className="h-11 sm:h-9 flex-1"
          >
            <Check className="size-4 mr-1.5" />
            Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => setRejectOpen(true)}
            className="h-11 sm:h-9 flex-1"
          >
            <X className="size-4 mr-1.5" />
            Reject
          </Button>
        </div>
      )}

      {/* Campaign performance (Item 3) */}
      {metrics !== undefined && <MetricsCard metrics={metrics} />}

      {/* Reject dialog, scoped to this detail panel */}
      <Dialog open={rejectOpen} onOpenChange={(open) => { if (!open) { setRejectOpen(false); setRejectFeedback(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject creative</DialogTitle>
            <DialogDescription>
              Tell the team what needs to change. They will see your feedback and revise the asset.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="What needs to change? (e.g. logo too small, wrong call-to-action)"
            value={rejectFeedback}
            onChange={(e) => setRejectFeedback(e.target.value)}
            autoFocus
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => { setRejectOpen(false); setRejectFeedback(''); }} disabled={reject.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSubmitReject} disabled={reject.isPending || rejectFeedback.trim().length === 0}>
              Submit rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
