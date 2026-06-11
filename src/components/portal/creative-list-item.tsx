import { Image as ImageIcon, Video, FileText, Check, X, Clock } from 'lucide-react';
import type { CreativeApprovalState } from '@/lib/hooks/use-portal';

// Shared compact row for the side-panel layout on /portal/compliance and
// /portal/creatives. Restyled to the Statto design (creative-card + cc-* +
// pill). Selected state = ink outline; clicking sets the parent's selectedId
// so the right-hand detail panel updates without a route push or refetch.

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

export function StatusPill({ status, compact = false }: { status: CreativeApprovalState['status']; compact?: boolean }) {
  const sz = compact ? 'size-3' : 'size-[13px]';
  if (status === 'approved') return <span className="pill p-soft"><Check className={sz} />Approved</span>;
  if (status === 'rejected') return <span className="pill p-neg"><X className={sz} />Rejected</span>;
  if (status === 'changes_requested') return <span className="pill p-warn">Changes requested</span>;
  return <span className="pill p-gray"><Clock className={sz} />Pending</span>;
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
      title={item.name}
      className="card creative-card"
      style={{
        alignItems: 'flex-start',
        outline: selected ? '2px solid var(--statto-ink)' : '1px solid var(--border)',
        outlineOffset: selected ? '-2px' : '-1px',
      }}
    >
      <span className="cc-thumb" style={{ width: 56, height: 56, borderRadius: 14 }}>
        {isImage ? (
          <img src={item.signedUrl!} alt={item.name} loading="lazy" />
        ) : isVideo ? (
          <video src={item.signedUrl!} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon className="size-5" />
        )}
      </span>
      <div className="cc-body">
        <span className="cc-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
        {item.campaignName && <span className="cc-fmt">{item.campaignName}</span>}
        {metricsLine && <span className="cc-fmt mono">{metricsLine}</span>}
        {/* "Signed off by …" lives in the detail panel; keeping it off the
            compact row keeps approved cards the same height as the others. */}
        <div style={{ marginTop: 2 }}><StatusPill status={item.approval.status} compact /></div>
      </div>
    </button>
  );
}
