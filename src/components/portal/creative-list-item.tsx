import { Badge } from '@/components/ui/badge';
import { Image as ImageIcon, Video, FileText, Check, X, Clock } from 'lucide-react';
import type { CreativeApprovalState } from '@/lib/hooks/use-portal';

// Sam (jam-video #3, 29-May-2026) — shared compact row for the side-panel
// layout on /portal/compliance and /portal/creatives. Selected state is a
// background tint + ring; clicking sets the parent's selectedId so the
// right-hand detail panel updates without a route push or refetch.

export interface CreativeListItemData {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  campaignName: string | null;
  signedUrl?: string | null;
  approval: CreativeApprovalState;
}

function iconFor(type: string) {
  if (type === 'image') return ImageIcon;
  if (type === 'video') return Video;
  return FileText;
}

function StatusChip({ status }: { status: CreativeApprovalState['status'] }) {
  if (status === 'approved') {
    return <Badge className="bg-positive/10 text-positive border-positive/30 text-[10px] h-5"><Check className="size-2.5 mr-0.5" />Approved</Badge>;
  }
  if (status === 'rejected') {
    return <Badge className="bg-negative/10 text-negative border-negative/30 text-[10px] h-5"><X className="size-2.5 mr-0.5" />Rejected</Badge>;
  }
  if (status === 'changes_requested') {
    return <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px] h-5">Changes</Badge>;
  }
  return <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px] h-5"><Clock className="size-2.5 mr-0.5" />Pending</Badge>;
}

interface Props {
  item: CreativeListItemData;
  selected: boolean;
  onSelect: () => void;
  /** Optional compact metric line (Item 3) — rendered below the name. */
  metricsLine?: string | null;
}

export function CreativeListItem({ item, selected, onSelect, metricsLine }: Props) {
  const Icon = iconFor(item.type);
  const isImage = item.type === 'image' && !!item.signedUrl;
  const isVideo = item.type === 'video' && !!item.signedUrl;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        'flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors ' +
        (selected
          ? 'border-primary/40 bg-accent ring-2 ring-primary/30'
          : 'hover:bg-accent/40 focus:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring')
      }
      title={item.name}
    >
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {isImage ? (
          <img src={item.signedUrl!} alt={item.name} className="size-full object-cover" loading="lazy" />
        ) : isVideo ? (
          <video src={item.signedUrl!} className="size-full object-cover" muted preload="metadata" />
        ) : (
          <Icon className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{item.name}</p>
        </div>
        {item.campaignName && (
          <p className="truncate text-[11px] text-muted-foreground">{item.campaignName}</p>
        )}
        {metricsLine && (
          <p className="truncate text-[11px] text-muted-foreground/90 tabular-nums">{metricsLine}</p>
        )}
        {/* Sam (jam-video #3, 29-May-2026): "shows you... who signed them off".
            Surface the approver + date on the row itself so the audit info is
            visible at a glance, not buried in the detail panel. */}
        {item.approval.status === 'approved' && item.approval.decidedByName && (
          <p className="truncate text-[11px] text-positive dark:text-positive">
            Signed off by <span className="font-medium">{item.approval.decidedByName}</span>
            {item.approval.decidedAt && (
              <> · {new Date(item.approval.decidedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</>
            )}
          </p>
        )}
        <div className="pt-0.5">
          <StatusChip status={item.approval.status} />
        </div>
      </div>
    </button>
  );
}
