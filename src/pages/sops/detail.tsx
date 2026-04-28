import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useSop } from '@/lib/hooks/use-sops';

const categoryColors: Record<string, string> = {
  Operations: 'bg-blue-500/10 text-blue-600 border-blue-200',
  Finance: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  Onboarding: 'bg-amber-500/10 text-amber-600 border-amber-200',
  Compliance: 'bg-purple-500/10 text-purple-600 border-purple-200',
  Campaigns: 'bg-rose-500/10 text-rose-600 border-rose-200',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: sop, isLoading, error } = useSop(id!);

  const canWrite = user?.role === 'owner' || user?.role === 'ops_manager';

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
        <div className="lg:col-span-2">
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
        </div>
      </div>
    </div>
  );
}
