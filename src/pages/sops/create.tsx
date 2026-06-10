import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles, Image as ImageIcon, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateSop,
  useSopTags,
  useGenerateSopFromLoom,
  parseLoomId,
  loomEmbedUrl,
  type SopScreenshot,
} from '@/lib/hooks/use-sops';
import { useUploadUrl } from '@/lib/hooks/use-uploads';
import { TagInput } from '@/components/shared/tag-input';
import { FileUpload } from '@/components/shared/file-upload';
import { useAuth } from '@/components/providers/auth-provider';

import { logError } from '../../lib/log';
const CATEGORIES = ['Operations', 'Finance', 'Onboarding', 'Compliance', 'Campaigns'] as const;

export function SopCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createSop = useCreateSop();
  const { data: tagSuggestions } = useSopTags();
  const generate = useGenerateSopFromLoom();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Operations');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [loomUrl, setLoomUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<SopScreenshot[]>([]);

  const loomValid = !loomUrl || !!parseLoomId(loomUrl);
  const embed = loomEmbedUrl(loomUrl);
  const canGenerate = loomValid && !!loomUrl.trim() && transcript.trim().length >= 30;

  async function handleGenerate() {
    if (!canGenerate) {
      toast.error('Paste a Loom URL and at least a snippet of the transcript first');
      return;
    }
    try {
      const draft = await generate.mutateAsync({ loomUrl: loomUrl.trim(), transcript: transcript.trim() });
      setTitle(draft.title);
      setCategory(draft.category);
      setContent(draft.content);
      setTags(draft.tags);
      toast.success('Draft generated — review and edit before creating');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      toast.error(msg);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error('SOP title is required'); return; }
    if (!content.trim()) { toast.error('SOP content is required'); return; }
    if (loomUrl && !loomValid) { toast.error('Loom URL doesn\'t look right — paste the full share link'); return; }

    try {
      const sop = await createSop.mutateAsync({
        title, category, content, status,
        loomUrl: loomUrl.trim() || null,
        tags,
        screenshots,
      });
      toast.success(`SOP "${sop.title}" created`);
      navigate(`/sops/${sop.id}`);
    } catch (err) {
      logError('Operation failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create SOP');
    }
  }

  return (
    <div className="screen-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/sops" className="nc-back" title="Back to SOPs"><ArrowLeft className="size-5" /></Link>
          <div>
            <h1 className="ahead-title">Create SOP</h1>
            <p className="ahead-sub">Add a new standard operating procedure</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="ct-layout">
          <div className="csop-main">
            <div className="card pad acard">
              <h3 className="statto-title csop-loom"><Sparkles className="size-[18px]" /> Generate from a Loom <span className="csop-opt">(optional)</span></h3>
              <p className="ac-sub" style={{ marginTop: 6, marginBottom: 18 }}>
                Paste a Loom share URL and the recording's transcript ("Show transcript" in Loom). The AI drafts a structured SOP — review and edit before saving.
              </p>
              <div className="nc-field">
                <label className="nc-label" htmlFor="sop-loom-wiz">Loom URL</label>
                <input
                  id="sop-loom-wiz"
                  className="nc-input"
                  type="url"
                  value={loomUrl}
                  onChange={(e) => setLoomUrl(e.target.value)}
                  placeholder="https://www.loom.com/share/…"
                  style={loomUrl && !loomValid ? { borderColor: 'var(--negative)' } : undefined}
                />
              </div>
              {embed && (
                <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)', paddingBottom: '56.25%', marginBottom: 18 }}>
                  <iframe src={embed} title="Loom preview" allowFullScreen style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }} />
                </div>
              )}
              <div className="nc-field">
                <label className="nc-label" htmlFor="sop-transcript">Transcript</label>
                <textarea
                  id="sop-transcript"
                  className="nc-textarea csop-transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste the Loom transcript here (Loom share page → 'Show transcript' → copy)…"
                />
              </div>
              <button type="button" className="btn b-sm csop-gen" onClick={handleGenerate} disabled={!canGenerate || generate.isPending}>
                {generate.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <Sparkles className="size-[15px]" />}
                {generate.isPending ? 'Generating…' : 'Generate SOP draft'}
              </button>
            </div>

            <div className="card pad acard">
              <h3 className="statto-title nc-h">SOP Details</h3>
              <div className="nc-field">
                <label className="nc-label">Title</label>
                <input
                  className="nc-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., New Client Onboarding Procedure"
                />
              </div>
              <div className="nc-field">
                <label className="nc-label">Category</label>
                <div className="nc-select-wrap">
                  <select className="nc-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
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
                <label className="nc-label">Content</label>
                <textarea
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
            <button type="submit" className="btn b-dark b-block ct-submit" disabled={createSop.isPending}>
              {createSop.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create SOP
            </button>

            <div className="card pad acard">
              <h3 className="statto-title csop-status-h">Status</h3>
              <div className="seg csop-status">
                <button type="button" className={'seg-btn' + (status === 'draft' ? ' on' : '')} onClick={() => setStatus('draft')}>Draft</button>
                <button type="button" className={'seg-btn' + (status === 'published' ? ' on' : '')} onClick={() => setStatus('published')}>Published</button>
              </div>
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {items.map((s) => (
        <ScreenshotThumb key={s.key} screenshot={s} onRemove={() => onRemove(s.key)} />
      ))}
    </div>
  );
}

function ScreenshotThumb({ screenshot, onRemove }: { screenshot: SopScreenshot; onRemove: () => void }) {
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
