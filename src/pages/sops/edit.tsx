import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSop, useUpdateSop } from '@/lib/hooks/use-sops';

const CATEGORIES = ['Operations', 'Finance', 'Onboarding', 'Compliance', 'Campaigns'] as const;

export function SopEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: sop, isLoading, error } = useSop(id!);
  const updateSop = useUpdateSop();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Operations');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  useEffect(() => {
    if (sop) {
      setTitle(sop.title);
      setCategory(sop.category);
      setContent(sop.content);
      setStatus(sop.status);
    }
  }, [sop]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!title.trim()) { toast.error('SOP title is required'); return; }
    if (!content.trim()) { toast.error('SOP content is required'); return; }

    try {
      const updated = await updateSop.mutateAsync({
        id,
        title,
        category,
        content,
        status,
      });
      toast.success(`SOP "${updated.title}" updated`);
      navigate(`/sops/${updated.id}`);
    } catch (err) {
      console.error('Operation failed', err);
      toast.error('Failed to update SOP');
    }
  }

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
      <div className="flex items-center gap-4">
        <Link to={`/sops/${sop.id}`}><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Edit SOP" description="Update standard operating procedure" />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Form Fields */}
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
                <Label>Content</Label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the SOP content here. Use separate paragraphs for each section..."
                  rows={16}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            <Button type="submit" className="w-full" disabled={updateSop.isPending}>
              {updateSop.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Save Changes
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
