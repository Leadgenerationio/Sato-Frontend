import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, X, Image as ImageIcon } from 'lucide-react';
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
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !sop) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>SOP not found</p>
        <Link to="/sops">
          <Button variant="outline"><ArrowLeft className="size-4 mr-2" />Back to SOPs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to={`/sops/${id}`}><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Edit SOP" description={sop.title} />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">SOP Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sop-title">Title</Label>
                <Input
                  id="sop-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., New Client Onboarding Procedure"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sop-category">Category</Label>
                <select
                  id="sop-category"
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
                <Label htmlFor="sop-loom">Loom URL (optional)</Label>
                <Input
                  id="sop-loom"
                  type="url"
                  value={loomUrl}
                  onChange={(e) => setLoomUrl(e.target.value)}
                  placeholder="https://www.loom.com/share/…"
                  className={loomUrl && !loomValid ? 'border-red-300' : ''}
                />
                {loomUrl && !loomValid && (
                  <p className="text-xs text-red-600">Expected a loom.com/share/&lt;id&gt; URL</p>
                )}
                {embed && (
                  <div className="relative w-full overflow-hidden rounded-md border" style={{ paddingBottom: '56.25%' }}>
                    <iframe src={embed} title="Loom preview" allowFullScreen className="absolute inset-0 h-full w-full" />
                  </div>
                )}
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
                <Label htmlFor="sop-content">Content</Label>
                <textarea
                  id="sop-content"
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
            <div className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={updateSop.isPending}>
                {updateSop.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                Save changes
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate(`/sops/${id}`)} disabled={updateSop.isPending}>
                Cancel
              </Button>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Status</CardTitle></CardHeader>
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

            <Card>
              <CardHeader><CardTitle className="text-base">Version</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Currently <span className="font-medium text-foreground">v{sop.version}</span>. The backend bumps this automatically when content changes.</p>
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
        <ScreenshotEditThumb key={s.key} screenshot={s} onRemove={() => onRemove(s.key)} />
      ))}
    </div>
  );
}

function ScreenshotEditThumb({ screenshot, onRemove }: { screenshot: SopScreenshot; onRemove: () => void }) {
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
