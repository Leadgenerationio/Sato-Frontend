import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Pencil, Video, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useSop, loomEmbedUrl } from '@/lib/hooks/use-sops';
import { useUploadUrl } from '@/lib/hooks/use-uploads';

const categoryColors: Record<string, string> = {
  Operations: 'bg-info-bg text-info border-info/30',
  Finance: 'bg-positive-bg text-positive border-positive/30',
  Onboarding: 'bg-warning-bg text-warning border-warning/30',
  Compliance: 'bg-lime-400/10 text-lime-600 border-lime-300',
  Campaigns: 'bg-negative-bg text-negative border-negative/30',
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
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (error || !sop) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>SOP not found</p>
        <Link to="/sops">
          <Button variant="outline">
            <ArrowLeft className="size-4 mr-2" />Back to SOPs
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/sops">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
        </Link>
        <div className="flex-1">
          <PageHeader title={sop.title}>
            <Badge className={`${categoryColors[sop.category] || ''}`}>
              {sop.category}
            </Badge>
            <Badge variant="secondary">v{sop.version}</Badge>
            {sop.status === 'draft' && (
              <Badge variant="outline" className="text-muted-foreground">Draft</Badge>
            )}
            {canWrite && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/sops/${sop.id}/edit`}>
                  <Pencil className="size-4 mr-1.5" />
                  Edit
                </Link>
              </Button>
            )}
          </PageHeader>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {embedUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="size-4" /> Walkthrough
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative w-full overflow-hidden rounded-md border" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={embedUrl}
                    title="Loom walkthrough"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
                {sop.loomUrl && (
                  <a
                    href={sop.loomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-muted-foreground hover:underline"
                  >
                    Open in Loom →
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {sop.content}
              </pre>
            </CardContent>
          </Card>

          {sop.screenshots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="size-4" /> Screenshots ({sop.screenshots.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {sop.screenshots.map((s) => (
                    <ScreenshotThumb key={s.key} screenshot={s} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Author</span>
                <span className="font-medium">{sop.author}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Category</span>
                <Badge className={`text-xs ${categoryColors[sop.category] || ''}`}>{sop.category}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">v{sop.version}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={sop.status === 'published' ? 'default' : 'outline'} className="text-xs capitalize">
                  {sop.status}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium tabular-nums">{formatDate(sop.lastUpdated)}</span>
              </div>
            </CardContent>
          </Card>

          {sop.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {sop.tags.map((t) => (
                    <Link key={t} to={`/sops?tag=${encodeURIComponent(t)}`}>
                      <Badge variant="outline" className="hover:bg-muted cursor-pointer">{t}</Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
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
      className="group relative aspect-video overflow-hidden rounded-md border bg-muted"
      title={screenshot.name}
    >
      {url ? (
        // eslint-disable-next-line jsx-a11y/img-redundant-alt
        <img src={url} alt={screenshot.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading…</div>
      )}
    </a>
  );
}
