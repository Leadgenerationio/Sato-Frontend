import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, X, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useSop, useUpdateSop, useSopTags, parseLoomId, loomEmbedUrl, type SopScreenshot } from '@/lib/hooks/use-sops';
import { useUploadUrl } from '@/lib/hooks/use-uploads';
import { TagInput } from '@/components/shared/tag-input';
import { FileUpload } from '@/components/shared/file-upload';
import { useAuth } from '@/components/providers/auth-provider';

import { logError } from '../../lib/log';
const CATEGORIES = ['Operations', 'Finance', 'Onboarding', 'Compliance', 'Campaigns'] as const;

export function SopEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: sop, isLoading, error } = useSop(id!);
  const { data: tagSuggestions } = useSopTags();
  const updateSop = useUpdateSop();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Operations');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [loomUrl, setLoomUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<SopScreenshot[]>([]);

  useEffect(() => {
    if (sop) {
      setTitle(sop.title);
      setCategory(sop.category);
      setContent(sop.content);
      setStatus(sop.status);
      setLoomUrl(sop.loomUrl ?? '');
      setTags(sop.tags);
      setScreenshots(sop.screenshots);
    }
  }, [sop]);

  const loomValid = !loomUrl || !!parseLoomId(loomUrl);
  const embed = loomEmbedUrl(loomUrl);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!title.trim()) { toast.error('SOP title is required'); return; }
    if (!content.trim()) { toast.error('SOP content is required'); return; }
    if (loomUrl && !loomValid) { toast.error('Loom URL doesn\'t look right — paste the full share link'); return; }

    try {
      const updated = await updateSop.mutateAsync({
        id, title, category, content, status,
        loomUrl: loomUrl.trim() || null,
        tags,
        screenshots,
      });
      toast.success(`SOP "${updated.title}" updated`);
      navigate(`/sops/${updated.id}`);
    } catch (err) {
      logError('Update SOP failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update SOP');
    }
  }

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
          <Link to={`/sops/${id}`} className="nc-back" title="Back to SOP"><ArrowLeft className="size-5" /></Link>
          <div>
            <h1 className="ahead-title">Edit SOP</h1>
            <p className="ahead-sub">{sop.title}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="ct-layout">
          <div className="csop-main">
            <div className="card pad acard">
              <h3 className="statto-title nc-h">SOP Details</h3>
              <div className="nc-field">
                <label className="nc-label" htmlFor="sop-title">Title</label>
                <input
                  id="sop-title"
                  className="nc-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., New Client Onboarding Procedure"
                />
              </div>

              <div className="nc-field">
                <label className="nc-label" htmlFor="sop-category">Category</label>
                <div className="nc-select-wrap">
                  <select id="sop-category" className="nc-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </div>

              <div className="nc-field">
                <label className="nc-label" htmlFor="sop-loom">Loom URL (optional)</label>
                <input
                  id="sop-loom"
                  className="nc-input"
                  type="url"
                  value={loomUrl}
                  onChange={(e) => setLoomUrl(e.target.value)}
                  placeholder="https://www.loom.com/share/…"
                  style={loomUrl && !loomValid ? { borderColor: 'var(--negative)' } : undefined}
                />
                {loomUrl && !loomValid && (
                  <p style={{ fontSize: 12, color: 'var(--negative)' }}>Expected a loom.com/share/&lt;id&gt; URL</p>
                )}
                {embed && (
                  <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', paddingBottom: '56.25%', marginTop: 8 }}>
                    <iframe src={embed} title="Loom preview" allowFullScreen style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }} />
                  </div>
                )}
              </div>

              <div className="nc-field">
                <label className="nc-label">Tags</label>
                <TagInput
                  value={tags}
                  onChange={setTags}
                  suggestions={tagSuggestions?.map((t) => t.tag) ?? []}
                  placeholder="Add a tag (e.g. software, creative, solar)…"
                />
              </div>

              <div className="nc-field">
                <label className="nc-label" htmlFor="sop-content">Content</label>
                <textarea
                  id="sop-content"
                  className="nc-textarea csop-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the SOP content here. Use separate paragraphs for each section..."
                />
              </div>

              <div className="nc-field">
                <label className="nc-label">Screenshots</label>
                <ScreenshotList
                  items={screenshots}
                  onRemove={(key) => setScreenshots(screenshots.filter((s) => s.key !== key))}
                />
              </div>
              <FileUpload
                folder="sops"
                accept="image/*"
                maxSizeMB={10}
                label="Upload screenshot"
                onUploaded={(result, file) => {
                  setScreenshots((prev) => [
                    ...prev,
                    {
                      key: result.key,
                      name: file.name,
                      size: file.size,
                      contentType: file.type,
                      uploadedAt: new Date().toISOString(),
                      uploadedBy: user?.email,
                    },
                  ]);
                }}
              />
            </div>
          </div>

          <div className="ct-side csop-side">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="submit" className="btn b-dark b-block ct-submit" disabled={updateSop.isPending}>
                {updateSop.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save changes
              </button>
              <button type="button" className="btn b-ghost b-block" onClick={() => navigate(`/sops/${id}`)} disabled={updateSop.isPending}>
                Cancel
              </button>
            </div>

            <div className="card pad acard">
              <h3 className="statto-title csop-status-h">Status</h3>
              <div className="seg csop-status">
                <button type="button" className={'seg-btn' + (status === 'draft' ? ' on' : '')} onClick={() => setStatus('draft')}>Draft</button>
                <button type="button" className={'seg-btn' + (status === 'published' ? ' on' : '')} onClick={() => setStatus('published')}>Published</button>
              </div>
            </div>

            <div className="card pad acard">
              <h3 className="statto-title nc-h">Version</h3>
              <p className="ac-sub">Currently <strong style={{ color: 'var(--fg1)' }}>v{sop.version}</strong>. The backend bumps this automatically when content changes.</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function ScreenshotList({ items, onRemove }: { items: SopScreenshot[]; onRemove: (key: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="csop-drop">
        <ImageIcon className="size-[26px]" />
        <span>No screenshots yet</span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 8 }}>
      {items.map((s) => (
        <ScreenshotEditThumb key={s.key} screenshot={s} onRemove={() => onRemove(s.key)} />
      ))}
    </div>
  );
}

function ScreenshotEditThumb({ screenshot, onRemove }: { screenshot: SopScreenshot; onRemove: () => void }) {
  const { data: url } = useUploadUrl(screenshot.key);
  return (
    <div className="group" style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--gray-50)' }}>
      {url ? (
        <img src={url} alt={screenshot.name} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--fg2)' }}>Loading…</div>
      )}
      <button
        type="button"
        onClick={onRemove}
        style={{ position: 'absolute', right: 4, top: 4, borderRadius: 999, background: 'rgba(0,0,0,.7)', padding: 4, color: '#fff', border: 'none', cursor: 'pointer', display: 'inline-flex' }}
        aria-label={`Remove ${screenshot.name}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
