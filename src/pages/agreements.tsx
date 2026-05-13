import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, FileSignature, Loader2, RefreshCw, Send, CheckCircle2, XCircle, Clock, AlertCircle, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAgreements,
  useSendAgreement,
  useRefreshAgreementStatus,
  type AgreementStatus,
  type Agreement,
} from '@/lib/hooks/use-agreements';
import { useClient, useClients } from '@/lib/hooks/use-clients';
import { FileUpload } from '@/components/shared/file-upload';
import type { PresignedUpload } from '@/lib/hooks/use-uploads';
import { EmptyState } from '@/components/shared/empty-state';
import { useAgreementTemplates, usePreviewAgreementTemplate } from '@/lib/hooks/use-agreement-templates';

function statusBadge(status: AgreementStatus) {
  const map: Record<AgreementStatus, { label: string; classes: string; icon: React.ElementType }> = {
    sent: { label: 'Sent', classes: 'bg-sky-500/10 text-sky-700 border-sky-200', icon: Send },
    delivered: { label: 'Delivered', classes: 'bg-indigo-500/10 text-indigo-700 border-indigo-200', icon: Clock },
    completed: { label: 'Completed', classes: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    signed: { label: 'Signed', classes: 'bg-emerald-500/10 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    declined: { label: 'Declined', classes: 'bg-red-500/10 text-red-700 border-red-200', icon: XCircle },
    voided: { label: 'Voided', classes: 'bg-muted text-muted-foreground border-muted', icon: AlertCircle },
  };
  const { label, classes, icon: Icon } = map[status] ?? map.sent;
  return (
    <Badge className={classes}>
      <Icon className="size-3 mr-1" />
      {label}
    </Badge>
  );
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface SendAgreementDialogProps {
  /** Pre-fill any of the form fields. Useful when launching from a client/buyer profile. */
  prefill?: { clientId?: string; signerName?: string; signerEmail?: string };
  /** Lock the client selector when launched from a specific client/buyer page. */
  lockClient?: boolean;
  /** Custom trigger node. Defaults to a "Send for signature" button. */
  trigger?: React.ReactNode;
  /** Controlled-mode: parent owns open state. When provided, hides the trigger. */
  open?: boolean;
  /** Controlled-mode: notify parent when dialog opens/closes. */
  onOpenChange?: (open: boolean) => void;
}

export function SendAgreementDialog({ prefill, lockClient = false, trigger, open: openProp, onOpenChange: onOpenChangeProp }: SendAgreementDialogProps = {}) {
  const navigate = useNavigate();
  const [openInternal, setOpenInternal] = useState(false);
  // Allow parent to drive the dialog open state (used by /clients/create →
  // /clients/:id?send-agreement=1 auto-open flow).
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;
  const [clientId, setClientId] = useState(prefill?.clientId ?? '');
  const [signerEmail, setSignerEmail] = useState(prefill?.signerEmail ?? '');
  const [signerName, setSignerName] = useState(prefill?.signerName ?? '');
  // Sam Loom #68 — signatory role/title.
  const [signerRole, setSignerRole] = useState('');
  const [uploaded, setUploaded] = useState<{ key: string; name: string } | null>(null);
  // Template picker state
  const { data: templates } = useAgreementTemplates();
  const preview = usePreviewAgreementTemplate();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [overrides] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { data: clientsData } = useClients({ limit: 100 });
  const send = useSendAgreement();
  // When prefill carries a clientId, fetch its full record so we can show
  // staff the company info as read-only context — fewer "wrong client"
  // mistakes per Sam's "make it error free" ask.
  const { data: prefilledClient } = useClient(prefill?.clientId ?? '');

  const clients = useMemo(() => clientsData?.clients ?? [], [clientsData]);

  // Re-sync state from prefill when the dialog opens — handles the case where
  // prefill arrives async (e.g. client data loads after parent renders).
  useEffect(() => {
    if (!open) return;
    setClientId(prefill?.clientId ?? '');
    setSignerEmail(prefill?.signerEmail ?? '');
    setSignerName(prefill?.signerName ?? '');
    setSignerRole('');
    setUploaded(null);
    setSelectedTemplateId(null);
    setEffectiveDate(new Date().toISOString().slice(0, 10));
    setPreviewUrl(null);
  }, [open, prefill?.clientId, prefill?.signerEmail, prefill?.signerName]);

  const reset = () => {
    setClientId(prefill?.clientId ?? '');
    setSignerEmail(prefill?.signerEmail ?? '');
    setSignerName(prefill?.signerName ?? '');
    setSignerRole('');
    setUploaded(null);
    setSelectedTemplateId(null);
    setEffectiveDate(new Date().toISOString().slice(0, 10));
    setPreviewUrl(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!isControlled) setOpenInternal(next);
    onOpenChangeProp?.(next);
    if (!next) reset();
  };

  const handleUploaded = (result: PresignedUpload, file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported for signing.');
      return;
    }
    setUploaded({ key: result.key, name: file.name });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !signerEmail || !signerName) {
      toast.error('Client, signer name and email are required.');
      return;
    }
    if (!selectedTemplateId && !uploaded) {
      toast.error('Either select a template or upload a PDF.');
      return;
    }
    try {
      const payload = selectedTemplateId
        ? {
            clientId,
            signerEmail,
            signerName,
            signerRole: signerRole.trim() || undefined,
            templateId: selectedTemplateId,
            overrides,
            effectiveDate,
          }
        : {
            clientId,
            signerEmail,
            signerName,
            signerRole: signerRole.trim() || undefined,
            r2SourceKey: uploaded!.key,
            r2SourceFolder: 'misc' as const,
            documentName: uploaded!.name,
          };
      await send.mutateAsync(payload);
      toast.success('Envelope sent via SignNow.');
      handleOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send agreement';
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm">
              <FileSignature className="size-4" />
              Send for signature
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send agreement for signature</DialogTitle>
            <DialogDescription>
              A SignNow envelope will be created and emailed to the signer. Status will update here once they sign.
            </DialogDescription>
          </DialogHeader>
          {prefilledClient && lockClient && (
            <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs">
              <p className="font-medium text-foreground">{prefilledClient.companyName}</p>
              <p className="text-muted-foreground">
                {prefilledClient.companyNumber ? `Co. ${prefilledClient.companyNumber} · ` : ''}
                {prefilledClient.address || 'No address on file'}
              </p>
              {typeof prefilledClient.creditScore === 'number' && (
                <p className="mt-1 text-muted-foreground">
                  Credit score: <span className="font-medium text-foreground">{prefilledClient.creditScore}</span>
                </p>
              )}
            </div>
          )}
          <div className="space-y-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="clientId">Client</Label>
              <select
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={lockClient}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                required
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signerName">Signer name</Label>
              <Input id="signerName" value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signerEmail">Signer email</Label>
              <Input id="signerEmail" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signerRole">
                Signer role / title <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="signerRole"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                placeholder="e.g. Director, CEO, Compliance Officer"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                The legal capacity they sign in — appears under the signature line + in the audit trail.
              </p>
            </div>

            {/* Template picker — only shown when templates exist */}
            {templates && templates.length > 0 && (
              <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                <div className="space-y-1.5">
                  <Label>Use a template (optional)</Label>
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                    value={selectedTemplateId ?? ''}
                    onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                  >
                    <option value="">— No template (upload PDF below) —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                {selectedTemplateId && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="effectiveDate">Effective date</Label>
                      <Input
                        id="effectiveDate"
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={preview.isPending}
                      onClick={async () => {
                        const resolvedClientId = prefill?.clientId ?? clientId;
                        if (!resolvedClientId) {
                          toast.error('No client context');
                          return;
                        }
                        try {
                          const blob = await preview.mutateAsync({
                            id: selectedTemplateId,
                            clientId: resolvedClientId,
                            overrides,
                            effectiveDate,
                          });
                          setPreviewUrl(URL.createObjectURL(blob));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Preview failed');
                        }
                      }}
                    >
                      {preview.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                      Refresh preview
                    </Button>
                    {previewUrl && (
                      <iframe src={previewUrl} className="w-full h-96 border rounded" title="populated preview" />
                    )}
                  </>
                )}
              </div>
            )}

            {/* PDF upload — only shown when no template is selected */}
            {!selectedTemplateId && (
              <div className="space-y-1.5">
                <Label>PDF document</Label>
                <FileUpload
                  folder="misc"
                  accept="application/pdf"
                  maxSizeMB={50}
                  label={uploaded ? 'Replace PDF' : 'Upload PDF'}
                  onUploaded={handleUploaded}
                />
                {uploaded && (
                  <p className="text-xs text-muted-foreground truncate">
                    <FileText className="inline size-3.5 mr-1" />
                    {uploaded.name} (uploaded to R2)
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={send.isPending}>Cancel</Button>
            {/* #47-50 — branch to the drag-place editor instead of sending
                free-form. Open in editor only enables once the PDF + client
                are populated; everything else can be edited from the editor.
                Hidden when using a template (fields already on template). */}
            {!selectedTemplateId && (
              <Button
                type="button"
                variant="outline"
                disabled={send.isPending || !uploaded || !clientId || !signerEmail || !signerName}
                onClick={() => {
                  if (!uploaded) return;
                  const params = new URLSearchParams({
                    r2Key: uploaded.key,
                    r2Folder: 'misc',
                    clientId,
                    signerEmail,
                    signerName,
                    documentName: uploaded.name,
                  });
                  handleOpenChange(false);
                  navigate(`/agreements/editor?${params.toString()}`);
                }}
              >
                <PenLine className="size-4" />
                Place fields...
              </Button>
            )}
            <Button type="submit" disabled={send.isPending}>
              {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send envelope
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RefreshButton({ id }: { id: string }) {
  const refresh = useRefreshAgreementStatus();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        refresh.mutate(id, {
          onSuccess: ({ agreement }) => toast.info(`Status: ${agreement.status}`),
          onError: () => toast.error('Failed to refresh status'),
        });
      }}
      disabled={refresh.isPending}
      aria-label="Refresh status"
    >
      {refresh.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
    </Button>
  );
}

export function AgreementsPage() {
  const { data, isLoading, refetch } = useAgreements();

  // Auto-poll while there's at least one envelope in a non-terminal state.
  const hasPending = (data?.agreements ?? []).some(
    (a) => a.status === 'sent' || a.status === 'delivered',
  );

  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => refetch(), 30000);
    return () => clearInterval(t);
  }, [hasPending, refetch]);

  const agreements: Agreement[] = data?.agreements ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agreements"
        description="Service agreements sent to clients via SignNow"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">All agreements</CardTitle>
            <CardDescription>
              {hasPending ? 'Auto-refreshing every 30s while envelopes are pending…' : 'Envelope statuses update via webhook.'}
            </CardDescription>
          </div>
          <SendAgreementDialog />
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-6 space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}
          {!isLoading && agreements.length === 0 && (
            <EmptyState
              icon={FileSignature}
              title="No agreements yet"
              description='Send a contract or onboarding document for e-signature. Use "Send for signature" above to start.'
            />
          )}
          {!isLoading && agreements.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Signer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Signed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agreements.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.signerName}
                        {a.signerRole && (
                          <span className="block text-xs text-muted-foreground font-normal mt-0.5">{a.signerRole}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.signerEmail}</TableCell>
                      <TableCell>{formatDateTime(a.sentAt)}</TableCell>
                      <TableCell>{formatDateTime(a.signedAt)}</TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell className="text-right">
                        <RefreshButton id={a.id} />
                        {a.documentUrl && (
                          <a href={a.documentUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline ml-2">
                            PDF
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
