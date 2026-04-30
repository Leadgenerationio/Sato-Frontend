import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Building, Mail, Phone, MapPin, Shield, FileText, Megaphone,
  CreditCard, ClipboardCheck, Loader2, TrendingDown, TrendingUp, AlertTriangle, Link2,
  Download, Trash2, FileSignature,
} from 'lucide-react';
import { toast } from 'sonner';
import { useClient, useCreditHistory, useRunCreditCheck } from '@/lib/hooks/use-clients';
import { FileUpload } from '@/components/shared/file-upload';
import { fetchFreshDownloadUrl } from '@/lib/hooks/use-uploads';
import { EmptyState } from '@/components/shared/empty-state';
import { SendAgreementDialog } from '@/pages/agreements';

const statusColors: Record<string, string> = {
  prospect: 'bg-blue-500/10 text-blue-600 border-blue-200',
  onboarding: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  churned: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

const riskColors: Record<string, string> = {
  very_low: 'text-emerald-600',
  low: 'text-emerald-500',
  moderate: 'text-amber-600',
  high: 'text-red-500',
  very_high: 'text-red-600',
};

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading, error } = useClient(id!);
  const { data: creditHistory, isLoading: creditLoading } = useCreditHistory(id!);
  const runCheck = useRunCreditCheck();

  if (isLoading) {
    return <div className="flex flex-col gap-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-96" /></div>;
  }

  if (error || !client) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>Client not found</p>
        <Link to="/clients"><Button variant="outline"><ArrowLeft className="size-4 mr-2" />Back to clients</Button></Link>
      </div>
    );
  }

  async function handleCreditCheck() {
    if (runCheck.isPending) return;
    try {
      const result = await runCheck.mutateAsync(id!);
      toast.success(`Credit check complete — score: ${result.creditScore}`);
    } catch (err) {
      console.error('Credit check failed', err);
      toast.error(err instanceof Error ? err.message : 'Credit check failed');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/clients"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <div className="flex-1">
          <PageHeader title={client.companyName} description={`${client.contactName} · ${client.companyNumber}`}>
            <div className="flex items-center gap-3">
              <Badge className={`capitalize ${statusColors[client.status] || ''}`}>{client.status}</Badge>
              <SendAgreementDialog
                lockClient
                prefill={{
                  clientId: client.id,
                  signerName: client.contactName,
                  signerEmail: client.contactEmail,
                }}
                trigger={
                  <Button size="sm" variant="default">
                    <FileSignature className="size-4 mr-1.5" />
                    Create Agreement
                  </Button>
                }
              />
            </div>
          </PageHeader>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="credit">Credit</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Company Details</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Building} label="Company" value={client.companyName} />
                <Separator />
                <InfoRow icon={Mail} label="Email" value={client.contactEmail} />
                <Separator />
                <InfoRow icon={Phone} label="Phone" value={client.contactPhone} />
                <Separator />
                <InfoRow icon={MapPin} label="Address" value={client.address} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Billing</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={CreditCard} label="Currency" value={client.currency} />
                <Separator />
                <InfoRow icon={FileText} label="Payment Terms" value={`${client.paymentTermsDays} days`} />
                <Separator />
                <InfoRow icon={Shield} label="VAT Registered" value={client.vatRegistered ? 'Yes' : 'No'} />
                <Separator />
                <InfoRow icon={CreditCard} label="Lead Price" value={formatCurrency(client.leadPrice, client.currency)} />
                <Separator />
                <InfoRow icon={ClipboardCheck} label="Billing Workflow" value={client.billingWorkflow.replace('_', ' ')} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">External System IDs</CardTitle>
                <CardDescription>How this client maps to LeadByte, Endole, and Xero</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Link2} label="LeadByte Client ID" value={client.leadbyteClientId || 'Not linked'} />
                <Separator />
                <InfoRow icon={Link2} label="Endole Company ID" value={client.endoleCompanyId || 'Not linked'} />
                <Separator />
                <InfoRow icon={Link2} label="Xero Contact ID" value={client.xeroContactId || 'Not linked'} />
              </CardContent>
            </Card>
            {client.notes && (
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{client.notes}</p></CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Campaigns</CardTitle>
              <CardDescription>{client.activeCampaigns} campaign{client.activeCampaigns !== 1 ? 's' : ''} running</CardDescription>
            </CardHeader>
            <CardContent>
              {client.activeCampaigns > 0 ? (
                <div className="flex items-center gap-3">
                  <Megaphone className="size-5 text-muted-foreground" />
                  <p className="text-sm">View campaigns for this client on the <Link to="/campaigns" className="text-primary underline">Campaigns page</Link>.</p>
                </div>
              ) : (
                <EmptyState
                  icon={Megaphone}
                  title="No active campaigns"
                  description="This client has no campaigns running yet. Campaigns sync automatically from LeadByte."
                  size="compact"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
              <CardDescription>Total revenue: {formatCurrency(client.totalRevenue, client.currency)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-muted-foreground" />
                <p className="text-sm">View invoices for this client on the <Link to="/finance/invoices" className="text-primary underline">Invoices page</Link>.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credit Tab */}
        <TabsContent value="credit" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Credit Score</h3>
              <p className="text-sm text-muted-foreground">
                {client.creditLastChecked ? `Last checked: ${formatDate(client.creditLastChecked)}` : 'Never checked'}
              </p>
            </div>
            <Button size="sm" onClick={handleCreditCheck} disabled={runCheck.isPending}>
              {runCheck.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Shield className="size-4 mr-1.5" />}
              Run Credit Check
            </Button>
          </div>

          {client.creditScore !== null && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="gap-3 py-5">
                <CardContent className="text-center">
                  <p className={`text-4xl font-bold tabular-nums ${client.creditScore >= 65 ? 'text-emerald-600' : client.creditScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {client.creditScore}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Credit Score</p>
                </CardContent>
              </Card>
              <Card className="gap-3 py-5">
                <CardContent className="text-center">
                  <p className={`text-lg font-semibold capitalize ${riskColors[client.creditRiskRating || ''] || ''}`}>
                    {(client.creditRiskRating || '').replace('_', ' ')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Risk Rating</p>
                </CardContent>
              </Card>
              <Card className="gap-3 py-5">
                <CardContent className="text-center">
                  <p className="text-lg font-semibold">{client.activeCampaigns}</p>
                  <p className="text-sm text-muted-foreground mt-1">Active Campaigns</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Credit History Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Credit History</CardTitle>
              <CardDescription>Score changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              {creditLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : !creditHistory?.length ? (
                <EmptyState
                  icon={Shield}
                  title="No credit history"
                  description='Run a credit check (button above) to record this client&apos;s score and track changes over time.'
                  size="compact"
                />
              ) : (
                <div className="space-y-3">
                  {creditHistory.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex size-10 items-center justify-center rounded-lg ${entry.creditScore >= 65 ? 'bg-emerald-500/10' : entry.creditScore >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
                          <span className={`text-sm font-bold tabular-nums ${entry.creditScore >= 65 ? 'text-emerald-600' : entry.creditScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {entry.creditScore}
                          </span>
                        </div>
                        <div>
                          <p className={`text-sm font-medium capitalize ${riskColors[entry.riskRating] || ''}`}>{entry.riskRating.replace('_', ' ')} risk</p>
                          <p className="text-xs text-muted-foreground">{formatDate(entry.checkedAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {entry.ccjCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="size-3 mr-1" />
                            {entry.ccjCount} CCJ
                          </Badge>
                        )}
                        {entry.scoreChange !== null && (
                          <span className={`flex items-center gap-1 text-xs font-medium ${entry.scoreChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {entry.scoreChange >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                            {entry.scoreChange > 0 ? '+' : ''}{entry.scoreChange}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Onboarding Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['pending', 'documents_received', 'agreement_signed', 'active'].map((step, i) => {
                  const steps = ['pending', 'documents_received', 'agreement_signed', 'active'];
                  const currentIdx = steps.indexOf(client.onboardingStatus);
                  const isDone = i <= currentIdx;
                  const isCurrent = i === currentIdx;
                  return (
                    <div key={step} className="flex items-center gap-4">
                      <div className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${
                        isDone ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                      } ${isCurrent ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className={`text-sm font-medium capitalize ${isDone ? '' : 'text-muted-foreground'}`}>{step.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  );
                })}
                <Separator />
                <div className="flex items-center gap-2 text-sm">
                  <ClipboardCheck className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Agreement:</span>
                  <span className="font-medium">{client.agreementSigned ? 'Signed' : 'Not signed'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <DocumentsTab clientId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Documents tab (R2-backed) ──────────────────────────────────────────────
//
// Files are uploaded to Cloudflare R2 via the shared <FileUpload> component.
// File metadata (key, name, size, contentType, uploadedAt) is persisted in
// localStorage keyed by clientId — this is intentional MVP scope. When the
// `clients` table grows a `documents` JSONB column (or a `client_documents`
// table), swap the localStorage helpers for a real React Query hook against
// `/api/v1/clients/:id/documents` — the rest of this component stays the same.

interface ClientDocument {
  key: string;
  folder: 'misc';
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

const DOCS_LS_KEY = (clientId: string) => `stato:client-docs:${clientId}`;

function loadDocs(clientId: string): ClientDocument[] {
  try {
    const raw = localStorage.getItem(DOCS_LS_KEY(clientId));
    return raw ? (JSON.parse(raw) as ClientDocument[]) : [];
  } catch {
    return [];
  }
}

function saveDocs(clientId: string, docs: ClientDocument[]) {
  localStorage.setItem(DOCS_LS_KEY(clientId), JSON.stringify(docs));
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({ clientId }: { clientId: string }) {
  const [docs, setDocs] = useState<ClientDocument[]>(() => loadDocs(clientId));
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    setDocs(loadDocs(clientId));
  }, [clientId]);

  const handleUploaded = (
    result: { key: string; folder: string; contentType: string; sizeBytes: number },
    file: File,
  ) => {
    const newDoc: ClientDocument = {
      key: result.key,
      folder: 'misc',
      name: file.name,
      size: result.sizeBytes,
      contentType: result.contentType,
      uploadedAt: new Date().toISOString(),
    };
    const updated = [newDoc, ...docs];
    setDocs(updated);
    saveDocs(clientId, updated);
  };

  const handleDownload = async (doc: ClientDocument) => {
    try {
      setDownloadingKey(doc.key);
      const url = await fetchFreshDownloadUrl(doc.folder, doc.key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Operation failed', err);
      toast.error('Failed to generate download link');
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleRemove = (key: string) => {
    const updated = docs.filter((d) => d.key !== key);
    setDocs(updated);
    saveDocs(clientId, updated);
    toast.info('Removed from list. File still exists in storage.');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Client Documents</CardTitle>
          <CardDescription>
            Due-diligence documents, contracts, and other client files. Stored in Cloudflare R2.
          </CardDescription>
        </div>
        <FileUpload
          folder="misc"
          maxSizeMB={50}
          label="Upload document"
          onUploaded={handleUploaded}
        />
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents"
            description="Upload contracts, agreements, or compliance docs using the button above. Files are stored securely in Cloudflare R2."
            size="compact"
          />
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={d.name}>{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(d.size)} · uploaded {formatDate(d.uploadedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(d)}
                    disabled={downloadingKey === d.key}
                    aria-label="Download"
                  >
                    {downloadingKey === d.key ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(d.key)}
                    aria-label="Remove from list"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
