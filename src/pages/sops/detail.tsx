import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Video, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useSop, loomEmbedUrl } from '@/lib/hooks/use-sops';
import { useUploadUrl } from '@/lib/hooks/use-uploads';

// Statto pill variant per SOP category.
const categoryPill: Record<string, string> = {
  Operations: 'infosoft',
  Finance: 'pos',
  Onboarding: 'soft',
  Compliance: 'warn',
  Campaigns: 'gray',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: sop, isLoading, error } = useSop(id!);

  const canWrite = user?.role === 'owner' || user?.role === 'ops_manager';
  const embedUrl = loomEmbedUrl(sop?.loomUrl);

  if (isLoading) {
    return (
      <div className="screen-page">
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg2)' }}>Loading SOP…</div>
      </div>
    );
  }

  if (error || !sop) {
    return (
      <div className="screen-page">
        <div className="ph-screen">
          <span className="ph-screen-ic"><ImageIcon className="size-[26px]" /></span>
          <strong>SOP not found</strong>
          <Link to="/sops"><button className="btn b-ghost b-sm"><ArrowLeft className="size-[15px]" /> Back to SOPs</button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/sops" className="nc-back" title="Back to SOPs"><ArrowLeft className="size-5" /></Link>
          <div>
            <h1 className="ahead-title">{sop.title}</h1>
            <div className="sop-tags" style={{ marginTop: 6 }}>
              <span className={'pill p-' + (categoryPill[sop.category] || 'gray')}>{sop.category}</span>
              <span className="sop-ver">v{sop.version}</span>
              {sop.status === 'draft' && <span className="pill p-gray">Draft</span>}
            </div>
          </div>
        </div>
        {canWrite && (
          <div className="page-actions">
            <Link to={`/sops/${sop.id}/edit`}>
              <button className="btn b-ghost b-sm"><Pencil className="size-[15px]" /> Edit</button>
            </Link>
          </div>
        )}
      </div>

      <div className="ct-layout">
        {/* Main Content */}
        <div className="csop-main">
          {embedUrl && (
            <div className="card pad acard">
              <h3 className="statto-title csop-loom" style={{ marginBottom: 16 }}><Video className="size-[18px]" /> Walkthrough</h3>
              <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', paddingBottom: '56.25%' }}>
                <iframe
                  src={embedUrl}
                  title="Loom walkthrough"
                  allowFullScreen
                  style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }}
                />
              </div>
              {sop.loomUrl && (
                <a
                  href={sop.loomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 8, display: 'inline-block', fontSize: 12, color: 'var(--fg2)' }}
                >
                  Open in Loom →
                </a>
              )}
            </div>
          )}

          <div className="card pad acard">
            <h3 className="statto-title nc-h">Content</h3>
            <pre style={{ fontSize: 14, color: 'var(--fg2)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6, margin: 0 }}>
              {sop.content}
            </pre>
          </div>

          {sop.screenshots.length > 0 && (
            <div className="card pad acard">
              <h3 className="statto-title csop-loom" style={{ marginBottom: 16 }}><ImageIcon className="size-[18px]" /> Screenshots ({sop.screenshots.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 12 }}>
                {sop.screenshots.map((s) => (
                  <ScreenshotThumb key={s.key} screenshot={s} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="ct-side csop-side">
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                <span style={{ color: 'var(--fg2)' }}>Author</span>
                <span style={{ fontWeight: 600, color: 'var(--fg1)' }}>{sop.author}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                <span style={{ color: 'var(--fg2)' }}>Category</span>
                <span className={'pill p-' + (categoryPill[sop.category] || 'gray')}>{sop.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                <span style={{ color: 'var(--fg2)' }}>Version</span>
                <span style={{ fontWeight: 600, color: 'var(--fg1)' }}>v{sop.version}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                <span style={{ color: 'var(--fg2)' }}>Status</span>
                <span className={'pill p-' + (sop.status === 'published' ? 'pos' : 'gray')} style={{ textTransform: 'capitalize' }}>{sop.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
                <span style={{ color: 'var(--fg2)' }}>Last Updated</span>
                <span style={{ fontWeight: 600, color: 'var(--fg1)' }}>{formatDate(sop.lastUpdated)}</span>
              </div>
            </div>
          </div>

          {sop.tags.length > 0 && (
            <div className="card pad acard">
              <h3 className="statto-title nc-h">Tags</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {sop.tags.map((t) => (
                  <Link key={t} to={`/sops?tag=${encodeURIComponent(t)}`}>
                    <span className="pill p-gray" style={{ cursor: 'pointer' }}>{t}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScreenshotThumb({ screenshot }: { screenshot: { key: string; name: string } }) {
  const { data: url } = useUploadUrl(screenshot.key);
  return (
    <a
      href={url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group"
      style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--gray-50)', display: 'block' }}
      title={screenshot.name}
    >
      {url ? (
        // eslint-disable-next-line jsx-a11y/img-redundant-alt
        <img src={url} alt={screenshot.name} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--fg2)' }}>Loading…</div>
      )}
    </a>
  );
}
