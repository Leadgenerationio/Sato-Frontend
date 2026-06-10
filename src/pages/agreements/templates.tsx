import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Copy, Archive, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
      <div className="screen-page">
        <div className="page-head">
          <div>
            <h1 className="ahead-title">Agreement Templates</h1>
            <p className="ahead-sub">Reusable templates with auto-populated client data</p>
          </div>
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const templates = data ?? [];

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Agreement Templates</h1>
          <p className="ahead-sub">Reusable templates with auto-populated client data</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn b-dark b-sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-[15px]" /> New Template
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="card acard">
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="Create your first template to auto-populate contracts with client data."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="card pad acard">
              <div className="mb-3">
                <h3 className="statto-title truncate">{t.name}</h3>
                <p className="ac-sub line-clamp-2">{t.description ?? '—'}</p>
              </div>
              <div className="ac-sub" style={{ marginBottom: 14 }}>
                {t.fieldLayout.length} field{t.fieldLayout.length === 1 ? '' : 's'} placed
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link to={`/agreements/templates/${t.id}`}>
                  <button type="button" className="btn b-ghost b-sm">
                    <Pencil className="size-[15px]" /> Edit
                  </button>
                </Link>
                <button
                  type="button"
                  className="btn b-ghost b-sm"
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
                  <Copy className="size-[15px]" /> Duplicate
                </button>
                <button
                  type="button"
                  className="btn b-ghost b-sm"
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
                  <Archive className="size-[15px]" /> Archive
                </button>
              </div>
            </div>
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
        <div className="py-2">
          <div className="nc-field">
            <label className="nc-label" htmlFor="name">Name</label>
            <input id="name" className="nc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lead Buyer Service Agreement v3" />
          </div>
          <div className="nc-field">
            <label className="nc-label" htmlFor="description">Description <span className="ag-opt">(optional)</span></label>
            <input id="description" className="nc-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Standard service agreement" />
          </div>
          <div className="nc-field">
            <label className="nc-label">Template PDF</label>
            {/* FileUpload.onUploaded signature: (result: PresignedUpload, file: File) => void
                Extract result.key for the R2 key. */}
            <FileUpload
              folder="agreements"
              accept="application/pdf"
              onUploaded={(result) => setPdfR2Key(result.key)}
            />
            {pdfR2Key && <span className="nc-hint">Uploaded: {pdfR2Key}</span>}
          </div>
          <div className="nc-field" style={{ marginBottom: 0 }}>
            <label className="nc-label" htmlFor="signerRole">Signer role <span className="ag-opt">(optional)</span></label>
            <input id="signerRole" className="nc-input" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} placeholder="e.g. Director" />
          </div>
        </div>
        <DialogFooter>
          <button type="button" className="btn b-ghost b-sm" onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className="btn b-dark b-sm" onClick={handleSubmit} disabled={create.isPending}>Create + Edit Fields</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
