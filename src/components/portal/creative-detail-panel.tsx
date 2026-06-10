import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Image as ImageIcon, Video, FileText, Check, X, Clock, CircleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useApproveCreative, useRejectCreative, type CreativeApprovalState } from '@/lib/hooks/use-portal';
import { StatusPill } from './creative-list-item';

// Right-hand detail panel that fills as the buyer clicks each row in the
// side-panel layout. Restyled to the Statto design (statto card + tokens),
// preserving the full asset preview, decision audit, approve/reject controls,
// and the campaign-performance metrics.

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

export interface CampaignMetrics {
  windowDays: number;
  spend: number;
  spendCurrency: string;
  validLeads: number;
  costPerLead: number | null;
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
      <div style={{ background: 'var(--gray-50)', borderRadius: 16, padding: '14px 18px' }}>
        <p className="lc-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CircleAlert className="size-[14px]" /> Performance data temporarily unavailable.
        </p>
      </div>
    );
  }
  const cpl = metrics.costPerLead;
  const cell = (value: string, label: string, note?: string) => (
    <div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--statto-ink)' }}>{value}</div>
      <div className="lc-sub" title={note ?? undefined}>{label}{note ? ' *' : ''}</div>
    </div>
  );
  return (
    <div style={{ background: 'var(--gray-50)', borderRadius: 16, padding: '16px 18px' }}>
      <p className="lc-sub" style={{ marginBottom: 10, fontWeight: 500 }}>Campaign performance · this month</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {cell(fmtMoney(metrics.spend, metrics.spendCurrency), 'Spend', metrics.notes?.spend)}
        {cell(metrics.validLeads.toLocaleString('en-GB'), 'Valid leads', metrics.notes?.leads)}
        {cell(cpl === null ? '—' : fmtMoney(cpl, metrics.spendCurrency), 'Cost per lead')}
      </div>
    </div>
  );
}

interface Props {
  creative: CreativeDetailData;
  /** When true (Compliance), show Approve/Reject controls for pending rows. */
  showDecisionControls?: boolean;
  /** Optional campaign-performance card. null = error; undefined = hide entirely. */
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
    if (trimmed.length === 0) { toast.error('Please tell us what needs to change'); return; }
    try {
      await reject.mutateAsync({ creativeId: creative.id, feedback: trimmed });
      toast.success('Creative rejected with feedback');
      setRejectOpen(false);
      setRejectFeedback('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record rejection');
    }
  }

  // Decision-audit banner tint per status.
  const auditStyle =
    ap.status === 'approved' ? { background: 'var(--lime-50)', color: 'var(--green-700)' }
    : (ap.status === 'rejected' || ap.status === 'changes_requested') ? { background: 'var(--negative-bg)', color: 'var(--negative)' }
    : { background: 'var(--warning-bg)', color: 'var(--warning)' };

  return (
    <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="cc-row" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="statto-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{creative.name}</h3>
          <p className="lc-sub">
            {creative.campaignName ? <>{creative.campaignName} · </> : null}
            Uploaded {formatDate(creative.uploadedAt)} · <span style={{ textTransform: 'capitalize' }}>{creative.type}</span>
          </p>
        </div>
        <StatusPill status={ap.status} />
      </div>

      {/* Media */}
      <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 16, minHeight: 280, maxHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 16 }}>
        {isImg ? (
          <img src={creative.signedUrl!} alt={creative.name} style={{ maxHeight: '56vh', width: 'auto', objectFit: 'contain', borderRadius: 8 }} />
        ) : isVid ? (
          <video src={creative.signedUrl!} style={{ maxHeight: '56vh', width: 'auto' }} controls autoPlay muted />
        ) : creative.signedUrl || creative.fileUrl ? (
          <a href={creative.signedUrl ?? creative.fileUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="cc-open" style={{ padding: '48px 24px' }}>
            Open {creative.name} ↗
          </a>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--fg3)', padding: '48px 0' }}>
            <Icon className="size-8" />
            <p className="lc-sub">No preview available</p>
          </div>
        )}
      </div>

      {/* Decision audit */}
      <div style={{ ...auditStyle, borderRadius: 12, padding: '11px 14px', fontSize: 13.5, lineHeight: 1.5 }}>
        {ap.status === 'approved' && (
          <span><Check className="size-4" style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />Signed off
            {ap.decidedByName && <> by <strong>{ap.decidedByName}</strong></>}
            {ap.decidedAt && <> on {formatDateTime(ap.decidedAt)}</>}</span>
        )}
        {(ap.status === 'rejected' || ap.status === 'changes_requested') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span><X className="size-4" style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />
              {ap.status === 'rejected' ? 'Rejected' : 'Changes requested'}
              {ap.decidedByName && <> by <strong>{ap.decidedByName}</strong></>}
              {ap.decidedAt && <> on {formatDateTime(ap.decidedAt)}</>}</span>
            {ap.feedback && !/^(na|n\/a|none|-|nil)$/i.test(ap.feedback.trim()) && (
              <span style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', color: 'var(--fg1)' }}>
                <strong>Feedback:</strong> {ap.feedback}
              </span>
            )}
          </div>
        )}
        {isPending && (
          <span><Clock className="size-4" style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />Awaiting your review.
            {showDecisionControls && ' Each decision is timestamped with your IP for audit.'}</span>
        )}
      </div>

      {/* Decision controls (Compliance only, pending only) */}
      {showDecisionControls && isPending && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn b-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleApprove} disabled={approve.isPending}>
            <Check className="size-4" /> Approve
          </button>
          <button className="btn b-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setRejectOpen(true)}>
            <X className="size-4" /> Reject
          </button>
        </div>
      )}

      {/* Campaign performance */}
      {metrics !== undefined && <MetricsCard metrics={metrics} />}

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={(open) => { if (!open) { setRejectOpen(false); setRejectFeedback(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject creative</DialogTitle>
            <DialogDescription>Tell the team what needs to change. They will see your feedback and revise the asset.</DialogDescription>
          </DialogHeader>
          <textarea
            className="acct-input"
            style={{ minHeight: 120, resize: 'vertical' }}
            placeholder="What needs to change? (e.g. logo too small, wrong call-to-action)"
            value={rejectFeedback}
            onChange={(e) => setRejectFeedback(e.target.value)}
            autoFocus
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <button className="btn b-ghost b-sm" onClick={() => { setRejectOpen(false); setRejectFeedback(''); }} disabled={reject.isPending}>Cancel</button>
            <button className="btn b-sm" style={{ background: 'var(--negative)', color: '#fff' }} onClick={handleSubmitReject} disabled={reject.isPending || rejectFeedback.trim().length === 0}>
              Submit rejection
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
