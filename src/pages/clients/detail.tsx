import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
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
  Download, Trash2, FileSignature, Users, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useClient, useCreditHistory, useRunCreditCheck,
  useClientDocuments, useAddClientDocument, useRemoveClientDocument,
  useClientInvoices, useSyncClientInvoices,
  type ClientDocument,
} from '@/lib/hooks/use-clients';
import { toMoney, type InvoiceSummary } from '@/lib/hooks/use-invoices';
import { FileUpload } from '@/components/shared/file-upload';
import { fetchFreshDownloadUrl, type UploadFolder } from '@/lib/hooks/use-uploads';
import { EmptyState } from '@/components/shared/empty-state';
import { SendAgreementDialog } from '@/pages/agreements';

const contactTypeColors: Record<string, string> = {
  primary: 'bg-blue-500/10 text-blue-600 border-blue-200',
  billing: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  compliance: 'bg-purple-500/10 text-purple-600 border-purple-200',
  other: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

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

function formatAddress(c: {
  addressLine: string; addressTown: string; addressCounty: string; addressCountry: string; addressPostcode: string; address: string;
}): string {
  const parts = [c.addressLine, c.addressTown, c.addressCounty, c.addressPostcode, c.addressCountry].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  // Fall back to legacy single-field address for pre-migration rows.
  return c.address || '—';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: client, isLoading, error } = useClient(id!);
  const { data: creditHistory, isLoading: creditLoading } = useCreditHistory(id!);
  const runCheck = useRunCreditCheck();

  // Auto-open the Send Agreement dialog when arriving from /clients/create
  // with the "send agreement immediately" toggle on. Strip the query param
  // so a refresh doesn't re-open the dialog.
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  useEffect(() => {
    if (searchParams.get('send-agreement') === '1' && client) {
      setAgreementDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('send-agreement');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, client, setSearchParams]);

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
              <Button size="sm" variant="default" onClick={() => setAgreementDialogOpen(true)}>
                <FileSignature className="size-4 mr-1.5" />
                Create Agreement
              </Button>
              <SendAgreementDialog
                lockClient
                prefill={{
                  clientId: client.id,
                  signerName: client.contactName,
                  signerEmail: client.contactEmail,
                }}
                open={agreementDialogOpen}
                onOpenChange={setAgreementDialogOpen}
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
                <InfoRow icon={MapPin} label="Address" value={formatAddress(client)} />
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
                {client.vatRegistered && (
                  <>
                    <Separator />
                    <InfoRow icon={Shield} label="VAT Number" value={client.vatNumber || '—'} />
                    <Separator />
                    <InfoRow icon={Shield} label="VAT Rate" value={`${client.vatRate}%`} />
                  </>
                )}
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
                {client.leadbyteClientId && (
                  <>
                    <InfoRow icon={Link2} label="LeadByte Client ID" value={client.leadbyteClientId} />
                    <Separator />
                  </>
                )}
                <InfoRow icon={Link2} label="Endole Company ID" value={client.endoleCompanyId || 'Not linked'} />
                <Separator />
                <InfoRow icon={Link2} label="Xero Contact ID" value={client.xeroContactId || 'Not linked'} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="size-4" />
                  Contacts
                </CardTitle>
                <CardDescription>
                  {client.contacts.length} contact{client.contacts.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {client.contacts.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No contacts"
                    description="No contacts have been added to this client yet."
                    size="compact"
                  />
                ) : (
                  <div className="space-y-3">
                    {client.contacts.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{c.name}</p>
                            <Badge className={`capitalize text-xs ${contactTypeColors[c.contactType] || ''}`}>{c.contactType}</Badge>
                          </div>
                          {c.role && <p className="text-xs text-muted-foreground mt-0.5">{c.role}</p>}
                        </div>
                        <div className="flex flex-col items-end text-right text-xs text-muted-foreground">
                          {c.email && <span className="flex items-center gap-1"><Mail className="size-3" />{c.email}</span>}
                          {c.phone && <span className="flex items-center gap-1 mt-0.5"><Phone className="size-3" />{c.phone}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
          <InvoicesTab clientId={id!} clientCurrency={client.currency} totalRevenue={client.totalRevenue} />
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

// ─── Invoices tab (per-client Xero/Stato invoices) ─────────────────────────
//
// Sam's Loom #30: "I don't get why there is no invoices for this client".
// Before, this tab was a stub linking off to /finance/invoices. Now it pulls
// /api/v1/clients/:id/invoices and renders a proper table.

const invoiceStatusColors: Record<string, string> = {
  draft: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
  sent: 'bg-blue-500/10 text-blue-600 border-blue-200',
  authorised: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  overdue: 'bg-red-500/10 text-red-600 border-red-200',
};

function InvoicesTab({ clientId, clientCurrency, totalRevenue }: { clientId: string; clientCurrency: string; totalRevenue: number }) {
  const { data, isLoading, isError } = useClientInvoices(clientId);
  const sync = useSyncClientInvoices(clientId);
  const invoices = data?.invoices ?? [];

  const handleSync = async () => {
    try {
      const result = await sync.mutateAsync();
      if (result.message && result.synced === 0) {
        toast.info(result.message);
      } else if (result.synced === 0 && result.skipped > 0) {
        toast.success(`Already up to date · ${result.skipped} invoices in sync`);
      } else {
        const linkedMsg = result.linkedContact ? ' · auto-linked Xero contact' : '';
        toast.success(`Imported ${result.synced} invoice${result.synced !== 1 ? 's' : ''} from Xero${linkedMsg}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Invoices</CardTitle>
          <CardDescription>
            {invoices.length === 0
              ? `Total revenue: ${formatCurrency(totalRevenue, clientCurrency)}`
              : `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} · Total revenue: ${formatCurrency(totalRevenue, clientCurrency)}`}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <RefreshCw className="size-4 mr-1.5" />}
            Sync from Xero
          </Button>
          <Link to={`/finance/invoices?client=${clientId}`}>
            <Button variant="outline" size="sm">
              <FileText className="size-4 mr-1.5" />
              Open in invoices list
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load invoices"
            description="There was a problem loading invoices for this client. Refresh the page to try again."
            size="compact"
          />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description='No Stato invoices for this client. Click "Sync from Xero" above to pull invoices created directly in Xero, or "Open in invoices list" to create one.'
            size="compact"
          />
        ) : (
          <InvoicesTable invoices={invoices} />
        )}
      </CardContent>
    </Card>
  );
}

function InvoicesTable({ invoices }: { invoices: InvoiceSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-2.5 pl-2 pr-3 font-medium">Number</th>
            <th className="py-2.5 px-3 font-medium">Status</th>
            <th className="py-2.5 px-3 font-medium">Due</th>
            <th className="py-2.5 px-3 font-medium text-right tabular-nums">Amount</th>
            <th className="py-2.5 px-3 font-medium text-right">Overdue</th>
            <th className="py-2.5 pl-3 pr-2 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-3 pl-2 pr-3">
                <Link to={`/finance/invoices/${inv.id}`} className="font-medium underline-offset-2 hover:underline">
                  {inv.invoiceNumber || '—'}
                </Link>
                {inv.xeroInvoiceId && (
                  <p className="text-xs text-muted-foreground mt-0.5">Synced from Xero</p>
                )}
              </td>
              <td className="py-3 px-3">
                <Badge className={`capitalize text-xs ${invoiceStatusColors[inv.status] || ''}`}>{inv.status}</Badge>
              </td>
              <td className="py-3 px-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
              <td className="py-3 px-3 text-right tabular-nums font-medium">
                {formatCurrency(toMoney(inv.total), inv.currency)}
              </td>
              <td className="py-3 px-3 text-right">
                {inv.daysOverdue > 0 ? (
                  <Badge className="bg-red-500/10 text-red-600 border-red-200 text-xs">
                    {inv.daysOverdue}d
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-3 pl-3 pr-2">
                <Link to={`/finance/invoices/${inv.id}`} aria-label="Open invoice">
                  <Button variant="ghost" size="sm"><FileText className="size-4" /></Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Documents tab (R2 storage + Postgres metadata) ────────────────────────
//
// Sam's Loom #36: files were stored in browser localStorage and disappeared
// across browsers / clearing cache. Now: file bytes live in R2 (uploaded via
// presigned URL), metadata lives in client_documents with userId attribution.

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({ clientId }: { clientId: string }) {
  const { data: docs = [], isLoading } = useClientDocuments(clientId);
  const addDoc = useAddClientDocument(clientId);
  const removeDoc = useRemoveClientDocument(clientId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleUploaded = async (
    result: { key: string; folder: string; contentType: string; sizeBytes: number },
    file: File,
  ) => {
    try {
      await addDoc.mutateAsync({
        r2Key: result.key,
        folder: result.folder,
        name: file.name,
        contentType: result.contentType,
        sizeBytes: result.sizeBytes,
      });
    } catch (err) {
      console.error('Save document metadata failed', err);
      toast.error('Uploaded to storage, but failed to save document record');
    }
  };

  const handleDownload = async (doc: ClientDocument) => {
    try {
      setDownloadingId(doc.id);
      const url = await fetchFreshDownloadUrl(doc.folder as UploadFolder, doc.r2Key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Operation failed', err);
      toast.error('Failed to generate download link');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRemove = async (doc: ClientDocument) => {
    try {
      await removeDoc.mutateAsync(doc.id);
      toast.info('Removed from list. File still exists in storage.');
    } catch (err) {
      console.error('Remove failed', err);
      toast.error('Failed to remove document');
    }
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
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents"
            description="Upload contracts, agreements, or compliance docs using the button above. Files are stored securely in Cloudflare R2."
            size="compact"
          />
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={d.name}>{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(d.sizeBytes)} · uploaded {formatDate(d.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(d)}
                    disabled={downloadingId === d.id}
                    aria-label="Download"
                  >
                    {downloadingId === d.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(d)}
                    disabled={removeDoc.isPending}
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
