import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, FileSignature, Loader2, RefreshCw, Send, CheckCircle2, XCircle, Clock, AlertCircle, PenLine, ChevronDown } from 'lucide-react';
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

const STATUS_PILL: Record<AgreementStatus, { label: string; pill: string; icon: React.ElementType }> = {
  sent: { label: 'Sent', pill: 'infosoft', icon: Send },
  delivered: { label: 'Delivered', pill: 'infosoft', icon: Clock },
  completed: { label: 'Completed', pill: 'pos', icon: CheckCircle2 },
  signed: { label: 'Signed', pill: 'pos', icon: CheckCircle2 },
  declined: { label: 'Declined', pill: 'neg', icon: XCircle },
  voided: { label: 'Voided', pill: 'gray', icon: AlertCircle },
};

function statusBadge(status: AgreementStatus) {
  const { label, pill, icon: Icon } = STATUS_PILL[status] ?? STATUS_PILL.sent;
  return (
    <span className={'pill p-' + pill}>
      <Icon className="size-3" strokeWidth={2.4} />
      {label}
    </span>
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
  // Fetch the currently-selected client so we can both (a) show its company
  // info as read-only context when lockClient is set, and (b) auto-fill the
  // signer name/email from the client's primary contact (Sam 2026-05-14).
  const { data: selectedClient } = useClient(clientId);

  const clients = useMemo(() => clientsData?.clients ?? [], [clientsData]);

  // Tracks which clientId we've already auto-filled signer fields from, so
  // re-renders don't keep clobbering user edits. Cleared each time the dialog
  // re-opens.
  const lastAutoFilledFromRef = useRef<string | null>(null);

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
    // If prefill brought explicit signer values, treat those as the auto-fill
    // for this client so we don't immediately overwrite them with the
    // client record's contact details.
    lastAutoFilledFromRef.current =
      (prefill?.signerName || prefill?.signerEmail) ? (prefill?.clientId ?? null) : null;
  }, [open, prefill?.clientId, prefill?.signerEmail, prefill?.signerName]);

  // Auto-fill signer name + email from the selected client's primary contact.
  // Fires once per client selection — preserves manual edits made between
  // selections, but overwrites when the user switches to a different client.
  useEffect(() => {
    if (!clientId || !selectedClient || selectedClient.id !== clientId) return;
    if (lastAutoFilledFromRef.current === clientId) return;
    if (selectedClient.contactName) setSignerName(selectedClient.contactName);
    if (selectedClient.contactEmail) setSignerEmail(selectedClient.contactEmail);
    lastAutoFilledFromRef.current = clientId;
  }, [clientId, selectedClient]);

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
            <button type="button" className="btn b-dark b-sm">
              <FileSignature className="size-[15px]" />
              Send for signature
            </button>
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
          {selectedClient && lockClient && (
            <div className="mt-3 rounded-lg border p-3 text-xs" style={{ background: 'var(--gray-50)', color: 'var(--fg2)' }}>
              <p className="font-medium" style={{ color: 'var(--fg1)' }}>{selectedClient.companyName}</p>
              <p style={{ color: 'var(--fg2)' }}>
                {selectedClient.companyNumber ? `Co. ${selectedClient.companyNumber} · ` : ''}
                {selectedClient.address || 'No address on file'}
              </p>
              {typeof selectedClient.creditScore === 'number' && (
                <p className="mt-1" style={{ color: 'var(--fg2)' }}>
                  Credit score: <span className="font-medium" style={{ color: 'var(--fg1)' }}>{selectedClient.creditScore}</span>
                </p>
              )}
            </div>
          )}
          <div className="py-4">
            <div className="nc-field">
              <label className="nc-label" htmlFor="clientId">Client</label>
              <div className="nc-select-wrap">
                <select
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={lockClient}
                  className="nc-select nc-muted"
                  required
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
                <ChevronDown className="lic size-[15px]" />
              </div>
            </div>
            <div className="nc-field">
              <label className="nc-label" htmlFor="signerName">Signer name</label>
              <input id="signerName" className="nc-input" value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
            </div>
            <div className="nc-field">
              <label className="nc-label" htmlFor="signerEmail">Signer email</label>
              <input id="signerEmail" className="nc-input" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} required />
            </div>
            <div className="nc-field">
              <label className="nc-label" htmlFor="signerRole">
                Signer role / title <span className="ag-opt">(optional)</span>
              </label>
              <input
                id="signerRole"
                className="nc-input"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                placeholder="e.g. Director, CEO, Compliance Officer"
                maxLength={100}
              />
              <span className="nc-hint">
                The legal capacity they sign in — appears under the signature line + in the audit trail.
              </span>
            </div>

            {/* Template picker — only shown when templates exist */}
            {templates && templates.length > 0 && (
              <div className="nc-contact" style={{ marginBottom: 18 }}>
                <div className="nc-field" style={{ marginBottom: selectedTemplateId ? 18 : 0 }}>
                  <label className="nc-label">Use a template (optional)</label>
                  <div className="nc-select-wrap">
                    <select
                      className="nc-select"
                      value={selectedTemplateId ?? ''}
                      onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                    >
                      <option value="">— No template (upload PDF below) —</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="lic size-[15px]" />
                  </div>
                </div>
                {selectedTemplateId && (
                  <>
                    <div className="nc-field">
                      <label className="nc-label" htmlFor="effectiveDate">Effective date</label>
                      <input
                        id="effectiveDate"
                        className="nc-input"
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn b-ghost b-sm"
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
                      {preview.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Refresh preview
                    </button>
                    {previewUrl && (
                      <iframe src={previewUrl} className="w-full h-96 border rounded mt-3" title="populated preview" />
                    )}
                  </>
                )}
              </div>
            )}

            {/* PDF upload — only shown when no template is selected */}
            {!selectedTemplateId && (
              <div className="nc-field">
                <label className="nc-label">PDF document</label>
                <FileUpload
                  folder="misc"
                  accept="application/pdf"
                  maxSizeMB={50}
                  label={uploaded ? 'Replace PDF' : 'Upload PDF'}
                  onUploaded={handleUploaded}
                />
                {uploaded && (
                  <span className="nc-hint truncate">
                    <FileText className="inline size-3.5 mr-1" />
                    {uploaded.name} (uploaded to R2)
                  </span>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" className="btn b-ghost b-sm" onClick={() => handleOpenChange(false)} disabled={send.isPending}>Cancel</button>
            {/* #47-50 — branch to the drag-place editor instead of sending
                free-form. Open in editor only enables once the PDF + client
                are populated; everything else can be edited from the editor.
                Hidden when using a template (fields already on template). */}
            {!selectedTemplateId && (
              <button
                type="button"
                className="btn b-ghost b-sm"
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
                <PenLine className="size-[15px]" />
                Place fields...
              </button>
            )}
            <button type="submit" className="btn b-dark b-sm" disabled={send.isPending}>
              {send.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <Send className="size-[15px]" />}
              Send envelope
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RefreshButton({ id }: { id: string }) {
  const refresh = useRefreshAgreementStatus();
  return (
    <button
      type="button"
      className="inv-open"
      title="Refresh status"
      onClick={() => {
        refresh.mutate(id, {
          onSuccess: ({ agreement }) => toast.info(`Status: ${agreement.status}`),
          onError: () => toast.error('Failed to refresh status'),
        });
      }}
      disabled={refresh.isPending}
      aria-label="Refresh status"
    >
      {refresh.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
    </button>
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
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Agreements</h1>
          <p className="ahead-sub">Service agreements sent to clients via SignNow</p>
        </div>
      </div>

      <div className="card acard ag-card">
        <div className="ag-head">
          <div>
            <h3 className="statto-title">All agreements</h3>
            <p className="ac-sub">
              {hasPending ? 'Auto-refreshing every 30s while envelopes are pending…' : 'Envelope statuses update via webhook.'}
            </p>
          </div>
          <SendAgreementDialog />
        </div>
        {isLoading && (
          <div style={{ padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          <div className="table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Signer</th>
                  <th>Email</th>
                  <th>Sent</th>
                  <th>Signed</th>
                  <th>Status</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agreements.map((a) => (
                  <tr key={a.id}>
                    <td className="ag-signer">
                      {a.signerName}
                      {a.signerRole && (
                        <span className="block font-normal mt-0.5" style={{ fontSize: 12.5, color: 'var(--fg3)' }}>{a.signerRole}</span>
                      )}
                    </td>
                    <td className="ag-email">{a.signerEmail}</td>
                    <td className="inv-date">{formatDateTime(a.sentAt)}</td>
                    <td className="inv-date">{formatDateTime(a.signedAt)}</td>
                    <td>{statusBadge(a.status)}</td>
                    <td className="r">
                      <div className="sos-actions">
                        <RefreshButton id={a.id} />
                        {a.documentUrl && (
                          <a href={a.documentUrl} target="_blank" rel="noreferrer" className="sos-page">
                            PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
