import { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, FileSignature, Loader2, RefreshCw, Send, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAgreements,
  useSendAgreement,
  useRefreshAgreementStatus,
  type AgreementStatus,
  type Agreement,
} from '@/lib/hooks/use-agreements';
import { useClients } from '@/lib/hooks/use-clients';
import { FileUpload } from '@/components/shared/file-upload';
import type { PresignedUpload } from '@/lib/hooks/use-uploads';
import { EmptyState } from '@/components/shared/empty-state';

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

function SendDialog() {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState('');
  const [uploaded, setUploaded] = useState<{ key: string; name: string } | null>(null);
  const { data: clientsData } = useClients({ limit: 100 });
  const send = useSendAgreement();

  const clients = useMemo(() => clientsData?.clients ?? [], [clientsData]);

  const reset = () => {
    setClientId('');
    setSignerEmail('');
    setSignerName('');
    setUploaded(null);
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
    if (!clientId || !signerEmail || !signerName || !uploaded) {
      toast.error('All fields are required (upload a PDF first).');
      return;
    }
    try {
      await send.mutateAsync({
        clientId,
        signerEmail,
        signerName,
        r2SourceKey: uploaded.key,
        r2SourceFolder: 'misc',
        documentName: uploaded.name,
      });
      toast.success('Envelope sent via SignNow.');
      setOpen(false);
      reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send agreement';
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FileSignature className="size-4" />
          Send for signature
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send agreement for signature</DialogTitle>
            <DialogDescription>
              A SignNow envelope will be created and emailed to the signer. Status will update here once they sign.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="clientId">Client</Label>
              <select
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={send.isPending}>Cancel</Button>
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
          <SendDialog />
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
                    <TableCell className="font-medium">{a.signerName}</TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
