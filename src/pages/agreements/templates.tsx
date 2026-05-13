import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Copy, Archive, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/shared/file-upload';
import { EmptyState } from '@/components/shared/empty-state';
import {
  useAgreementTemplates,
  useCreateAgreementTemplate,
  useArchiveAgreementTemplate,
  useDuplicateAgreementTemplate,
} from '@/lib/hooks/use-agreement-templates';

export function AgreementTemplatesPage() {
  const { data, isLoading } = useAgreementTemplates();
  const archive = useArchiveAgreementTemplate();
  const duplicate = useDuplicateAgreementTemplate();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Agreement Templates" description="Reusable templates with auto-populated client data" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const templates = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Agreement Templates" description="Reusable templates with auto-populated client data">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" /> New Template
        </Button>
      </PageHeader>

      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Create your first template to auto-populate contracts with client data."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6 space-y-3">
                <div>
                  <h3 className="font-semibold text-base truncate">{t.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.description ?? '—'}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.fieldLayout.length} field{t.fieldLayout.length === 1 ? '' : 's'} placed
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/agreements/templates/${t.id}`}>
                      <Pencil className="size-3.5 mr-1.5" /> Edit
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const dup = await duplicate.mutateAsync(t.id);
                        toast.success(`Duplicated "${t.name}"`);
                        navigate(`/agreements/templates/${dup.id}`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Duplicate failed');
                      }
                    }}
                  >
                    <Copy className="size-3.5 mr-1.5" /> Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Archive "${t.name}"? Existing agreements that used this template are unaffected.`)) return;
                      try {
                        await archive.mutateAsync(t.id);
                        toast.success('Template archived');
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Archive failed');
                      }
                    }}
                  >
                    <Archive className="size-3.5 mr-1.5" /> Archive
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateTemplateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateAgreementTemplate();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pdfR2Key, setPdfR2Key] = useState('');
  const [signerRole, setSignerRole] = useState('');

  async function handleSubmit() {
    if (!name || !pdfR2Key) {
      toast.error('Name and PDF are required');
      return;
    }
    try {
      const created = await create.mutateAsync({
        name,
        description: description || undefined,
        pdfR2Key,
        signerRole: signerRole || undefined,
      });
      toast.success(`Template "${created.name}" created`);
      onOpenChange(false);
      navigate(`/agreements/templates/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Template</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lead Buyer Service Agreement v3" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Standard service agreement" />
          </div>
          <div className="space-y-1.5">
            <Label>Template PDF</Label>
            {/* FileUpload.onUploaded signature: (result: PresignedUpload, file: File) => void
                Extract result.key for the R2 key. */}
            <FileUpload
              folder="agreements"
              accept="application/pdf"
              onUploaded={(result) => setPdfR2Key(result.key)}
            />
            {pdfR2Key && <p className="text-xs text-muted-foreground">Uploaded: {pdfR2Key}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signerRole">Signer role (optional)</Label>
            <Input id="signerRole" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} placeholder="e.g. Director" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>Create + Edit Fields</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
