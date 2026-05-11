import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Sparkles, Image as ImageIcon, X } from 'lucide-react';
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
      console.error('Operation failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create SOP');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/sops"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Create SOP" description="Add a new standard operating procedure" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" /> Generate from a Loom (optional)
          </CardTitle>
          <CardDescription>
            Paste a Loom share URL and the recording's transcript ("Show transcript" in Loom). The AI drafts a structured SOP — review and edit before saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="sop-loom-wiz">Loom URL</Label>
            <Input
              id="sop-loom-wiz"
              type="url"
              value={loomUrl}
              onChange={(e) => setLoomUrl(e.target.value)}
              placeholder="https://www.loom.com/share/…"
              className={loomUrl && !loomValid ? 'border-red-300' : ''}
            />
          </div>
          {embed && (
            <div className="relative w-full overflow-hidden rounded-md border" style={{ paddingBottom: '56.25%' }}>
              <iframe src={embed} title="Loom preview" allowFullScreen className="absolute inset-0 h-full w-full" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="sop-transcript">Transcript</Label>
            <textarea
              id="sop-transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste the Loom transcript here (Loom share page → 'Show transcript' → copy)…"
              rows={6}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <Button type="button" onClick={handleGenerate} disabled={!canGenerate || generate.isPending}>
            {generate.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Sparkles className="size-4 mr-1.5" />}
            {generate.isPending ? 'Generating…' : 'Generate SOP draft'}
          </Button>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">SOP Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., New Client Onboarding Procedure"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <TagInput
                  value={tags}
                  onChange={setTags}
                  suggestions={tagSuggestions?.map((t) => t.tag) ?? []}
                  placeholder="Add a tag (e.g. software, creative, solar)…"
                />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the SOP content here. Use separate paragraphs for each section..."
                  rows={16}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <Label>Screenshots</Label>
                <ScreenshotList
                  items={screenshots}
                  onRemove={(key) => setScreenshots(screenshots.filter((s) => s.key !== key))}
                />
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
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Button type="submit" className="w-full" disabled={createSop.isPending}>
              {createSop.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Create SOP
            </Button>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus('draft')}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      status === 'draft'
                        ? 'bg-background text-foreground shadow-sm border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('published')}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      status === 'published'
                        ? 'bg-background text-foreground shadow-sm border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Published
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}

function ScreenshotList({ items, onRemove }: { items: SopScreenshot[]; onRemove: (key: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
        <ImageIcon className="mx-auto mb-1 size-4" />
        No screenshots yet
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((s) => (
        <ScreenshotThumb key={s.key} screenshot={s} onRemove={() => onRemove(s.key)} />
      ))}
    </div>
  );
}

function ScreenshotThumb({ screenshot, onRemove }: { screenshot: SopScreenshot; onRemove: () => void }) {
  const { data: url } = useUploadUrl(screenshot.key);
  return (
    <div className="group relative aspect-video overflow-hidden rounded-md border bg-muted">
      {url ? (
        <img src={url} alt={screenshot.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading…</div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
        aria-label={`Remove ${screenshot.name}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
