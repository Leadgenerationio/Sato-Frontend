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
  Activity as ActivityIcon, Inbox, Send, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useClient, useCreditHistory, useRunCreditCheck,
  useClientDocuments, useAddClientDocument, useRemoveClientDocument,
  useClientInvoices, useSyncClientInvoices,
  useUpdateClient,
  type ClientDocument,
} from '@/lib/hooks/use-clients';
import {
  useClientCampaigns,
  useUnlinkClientCampaign,
  type ClientCampaignLink,
} from '@/lib/hooks/use-client-campaigns';
import { AddCampaignDialog } from '@/components/clients/add-campaign-dialog';
import { PortalUsersCard } from '@/components/clients/portal-users-card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { toMoney, type InvoiceSummary } from '@/lib/hooks/use-invoices';
import {
  useClientActivity, useClientEmails, useLogClientEmail, useDeleteClientEmail,
  type ClientActivityEvent, type ClientEmail,
} from '@/lib/hooks/use-client-activity';
import { Input } from '@/components/ui/input';
import { FileUpload } from '@/components/shared/file-upload';
import { fetchFreshDownloadUrl, type UploadFolder } from '@/lib/hooks/use-uploads';
import { EmptyState } from '@/components/shared/empty-state';
import { SendAgreementDialog } from '@/pages/agreements';
import { EditClientButton } from '@/components/clients/edit-client-dialog';

import { logError } from '../../lib/log';
const contactTypeColors: Record<string, string> = {
  primary: 'bg-info/10 text-info border-info/30',
  billing: 'bg-positive/10 text-positive border-positive/30',
  compliance: 'bg-lime-400/10 text-lime-600 border-lime-300',
  other: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

// Sam Loom #31 (13 May response) — only 3 statuses surfaced. 'prospect'
// and 'paused' kept in the color map for back-compat in case a legacy row
// slipped through 0022; would render with the closest visual.
const statusColors: Record<string, string> = {
  onboarding: 'bg-info/10 text-info border-info/30',
  active:     'bg-positive/10 text-positive border-positive/30',
  churned:    'bg-neutral-500/10 text-neutral-500 border-neutral-200',
  // Legacy fallbacks — should be empty post-migration but kept for safety.
  prospect:   'bg-info/10 text-info border-info/30',
  paused:     'bg-warning/10 text-warning border-warning/30',
};

/**
 * Display the "Active Client" badge only when reality backs it up — same
 * principle as the onboarding stage indicator (see resolveActualStage). If
 * status='active' was set by an operator but the client has no documents
 * uploaded or hasn't signed the agreement, the badge downgrades to
 * 'onboarding' so it doesn't disagree with the stage strip below it.
 *
 * Non-active statuses (churned, etc.) pass through unchanged — they're
 * intentional end states, not onboarding progress.
 */
export function resolveDisplayedStatus(
  status: string,
  agreementSigned: boolean,
  documentsCount: number,
): string {
  if (status === 'active' && (documentsCount === 0 || !agreementSigned)) {
    return 'onboarding';
  }
  return status;
}

const statusLabels: Record<string, string> = {
  onboarding: 'Onboarding',
  active: 'Active Client',
  churned: 'Client Churned',
  prospect: 'Onboarding',
  paused: 'Client Churned',
};

const riskColors: Record<string, string> = {
  very_low: 'text-positive',
  low: 'text-positive',
  moderate: 'text-warning',
  high: 'text-negative',
  very_high: 'text-negative',
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
  // Documents count drives the onboarding stage indicator — see
  // OnboardingProgress derivation below. react-query dedupes this with the
  // copy inside DocumentsTab so we're not double-fetching.
  const { data: docsForStage } = useClientDocuments(id!);
  const runCheck = useRunCreditCheck();
  // Sam (27 May 2026 portal meeting): "this client is an existing client,
  // we've already signed an agreement, just not within this platform" —
  // admin override to flip agreementSigned without going through SignNow.
  const updateClient = useUpdateClient();
  const markAgreementSigned = async () => {
    if (!client) return;
    try {
      await updateClient.mutateAsync({ id: client.id, agreementSigned: true });
      toast.success('Agreement marked as signed — Pending banner will clear.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark agreement as signed');
    }
  };

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
      logError('Credit check failed', err);
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
              {(() => {
                const displayed = resolveDisplayedStatus(client.status, client.agreementSigned, docsForStage?.length ?? 0);
                return (
                  <Badge className={statusColors[displayed] || ''}>{statusLabels[displayed] ?? displayed}</Badge>
                );
              })()}
              <EditClientButton client={client} />
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

      {/*
        Newly-created clients don't have a Xero contact until something binds
        one (agreement-signature webhook auto-creates it via
        createXeroContactForClient(); name-match fallback fires when the user
        opens the Invoices tab). Without that binding, the Invoices tab is
        empty and the Revenue / Amount Owed totals stay at zero — which is
        confusing on first encounter. Surface a one-line, dismissible-feeling
        banner so the next step is obvious instead of inferred.
      */}
      {!client.xeroContactId && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <Link2 className="size-4 mt-0.5 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-medium text-warning">Not linked to Xero yet</p>
            <p className="text-warning/90">
              Invoices, revenue and Amount Owed will populate once a Xero contact is bound.
              Click <strong>Create Agreement</strong> above to auto-link on signature,
              or open <strong>Edit</strong> to paste a Xero Contact ID manually.
            </p>
          </div>
        </div>
      )}

      <OnboardingProgress
        onboardingStatus={client.onboardingStatus}
        agreementSigned={client.agreementSigned}
        documentsCount={docsForStage?.length ?? 0}
        onMarkAgreementSigned={markAgreementSigned}
        markAgreementPending={updateClient.isPending}
      />

      <Tabs defaultValue="overview">
        {/* T3 slice 3 (OCT-37): 7 tab triggers overflow 375px viewports, so
            wrap in a horizontally scrollable shell on small screens. The
            scroll container only ever clips when there's no room — desktop
            keeps the original look. */}
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="max-w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="credit">Credit</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>

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
                <CardDescription>How this client maps to LeadByte, the credit provider, and Xero</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {client.leadbyteClientId && (
                  <>
                    <InfoRow icon={Link2} label="LeadByte Client ID" value={client.leadbyteClientId} />
                    <Separator />
                  </>
                )}
                <InfoRow icon={Link2} label="Companies House number" value={client.endoleCompanyId || 'Not linked'} />
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
            {/* Sam (27 May 2026 meeting): "we have multiple people that we
                need to provide access to this account." Adds the portal
                users management card to every client detail Overview tab. */}
            <PortalUsersCard clientId={client.id} clientName={client.companyName} />
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
          <CampaignsTab clientId={id!} />
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
                  <p className={`text-4xl font-bold tabular-nums ${client.creditScore >= 65 ? 'text-positive' : client.creditScore >= 50 ? 'text-warning' : 'text-negative'}`}>
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
                        <div className={`flex size-10 items-center justify-center rounded-lg ${entry.creditScore >= 65 ? 'bg-positive/10' : entry.creditScore >= 50 ? 'bg-warning/10' : 'bg-negative/10'}`}>
                          <span className={`text-sm font-bold tabular-nums ${entry.creditScore >= 65 ? 'text-positive' : entry.creditScore >= 50 ? 'text-warning' : 'text-negative'}`}>
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
                          <span className={`flex items-center gap-1 text-xs font-medium ${entry.scoreChange >= 0 ? 'text-positive' : 'text-negative'}`}>
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

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <DocumentsTab clientId={id!} />
        </TabsContent>

        {/* L #33 — Emails tab */}
        <TabsContent value="emails" className="mt-6">
          <EmailsTab clientId={id!} />
        </TabsContent>

        {/* L #38 — Activity tab */}
        <TabsContent value="activity" className="mt-6">
          <ActivityTab clientId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Onboarding progress strip ─────────────────────────────────────────────
//
// Was previously a full Onboarding tab that hid the lifecycle state behind a
// tab click and confused Sam (2026-05-15 Loom: "I don't understand this
// section. What does it do? ... rather than having a tab, wasting a tab on
// it"). Now rendered inline above the tabs as a 4-step horizontal progress
// bar so Sam can read the client's onboarding state at a glance without
// hunting for it. Stages mirror the backend's enum (pending →
// documents_received → agreement_signed → active).

interface OnboardingStep {
  key: 'pending' | 'documents_received' | 'agreement_signed' | 'active';
  label: string;
  hint: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: 'pending', label: 'Pending', hint: 'Client created · awaiting next step' },
  { key: 'documents_received', label: 'Documents', hint: 'Onboarding documents received' },
  { key: 'agreement_signed', label: 'Agreement', hint: 'Service agreement signed via SignNow' },
  { key: 'active', label: 'Active', hint: 'Live client · campaigns can run' },
];

/**
 * Resolve the *real* onboarding stage from underlying data, not just the
 * onboarding_status enum. The enum is operator-set and drifts out of sync —
 * a client can be marked 'active' while having zero uploaded documents and
 * an unsigned agreement, which then shows green ticks for stages that
 * haven't actually been completed.
 *
 * The displayed stage is capped by what the data actually supports:
 *   - No documents uploaded → cap at 'pending' (stage 0)
 *   - Documents uploaded but agreement unsigned → cap at 'documents_received' (stage 1)
 *   - Documents uploaded AND agreement signed → trust the enum (stage 2 or 3)
 */
export function resolveActualStage(
  onboardingStatus: string,
  agreementSigned: boolean,
  documentsCount: number,
): number {
  const enumIdx = Math.max(
    0,
    ONBOARDING_STEPS.findIndex((s) => s.key === onboardingStatus),
  );
  const hasDocs = documentsCount > 0;
  if (!hasDocs) return 0;
  if (!agreementSigned) return Math.min(enumIdx, 1);
  return enumIdx;
}

export function OnboardingProgress({
  onboardingStatus,
  agreementSigned,
  documentsCount,
  onMarkAgreementSigned,
  markAgreementPending,
}: {
  onboardingStatus: string;
  agreementSigned: boolean;
  documentsCount: number;
  // Sam (27 May 2026 portal meeting): admin override for clients who
  // signed outside the platform. Both optional so existing callers
  // (tests / other pages) still compile without them.
  onMarkAgreementSigned?: () => void;
  markAgreementPending?: boolean;
}) {
  const currentIdx = resolveActualStage(onboardingStatus, agreementSigned, documentsCount);

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Onboarding
            </p>
            <p className="text-sm font-medium">
              Stage {currentIdx + 1} of {ONBOARDING_STEPS.length} · {ONBOARDING_STEPS[currentIdx]?.label ?? 'Unknown'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ClipboardCheck className={`size-4 ${agreementSigned ? 'text-positive' : 'text-muted-foreground'}`} />
            <span className="text-muted-foreground">Agreement:</span>
            <span className={`font-medium ${agreementSigned ? 'text-positive' : ''}`}>
              {agreementSigned ? 'Signed' : 'Not signed'}
            </span>
            {/* Sam (27 May 2026): admin override for clients who signed
                outside Stato — flips agreementSigned=true without going
                through SignNow. Only renders when not signed + a handler
                is provided. */}
            {!agreementSigned && onMarkAgreementSigned && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onMarkAgreementSigned}
                disabled={markAgreementPending}
              >
                {markAgreementPending
                  ? <Loader2 className="size-3 mr-1 animate-spin" />
                  : <ClipboardCheck className="size-3 mr-1" />}
                Mark as signed (external)
              </Button>
            )}
          </div>
        </div>

        <ol className="mt-4 flex items-start gap-1 overflow-x-auto pb-1">
          {ONBOARDING_STEPS.map((step, i) => {
            const isDone = i < currentIdx;
            const isCurrent = i === currentIdx;
            const isLast = i === ONBOARDING_STEPS.length - 1;
            return (
              <li key={step.key} className="flex flex-1 items-start gap-1 min-w-[120px]">
                <div className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full items-center gap-1">
                    {/* Trailing line before the dot — invisible on the first step so the
                        row aligns left without a phantom segment. */}
                    <div className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : isDone || isCurrent ? 'bg-positive' : 'bg-muted'}`} />
                    <div
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        isDone
                          ? 'bg-positive text-white'
                          : isCurrent
                            ? 'border-2 border-positive/30 bg-positive/10 text-positive'
                            : 'border border-muted-foreground/30 bg-muted text-muted-foreground'
                      }`}
                      title={step.hint}
                    >
                      {isDone ? '✓' : i + 1}
                    </div>
                    {/* Trailing line after the dot — invisible on the last step. */}
                    <div className={`h-0.5 flex-1 ${isLast ? 'invisible' : isDone ? 'bg-positive' : 'bg-muted'}`} />
                  </div>
                  <div className="text-center">
                    <p className={`text-xs font-medium ${isDone || isCurrent ? '' : 'text-muted-foreground'}`}>{step.label}</p>
                    <p className="text-[10px] leading-tight text-muted-foreground">{step.hint}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

// ─── Campaigns tab (P5 — inline list + Add Campaign dialog) ────────────────
//
// Sam's 12 May call: "how do we add a campaign here?". Was previously a stub
// linking off to /campaigns. Now shows the linked campaigns inline with a
// Remove button per row and an Add Campaign button that opens a dialog.

const campaignStatusColors: Record<string, string> = {
  active:   'bg-positive/10 text-positive border-positive/30',
  paused:   'bg-warning/10 text-warning border-warning/30',
  inactive: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
  archived: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

function CampaignsTab({ clientId }: { clientId: string }) {
  const { data: campaigns = [], isLoading } = useClientCampaigns(clientId);
  const unlink = useUnlinkClientCampaign();
  const [addOpen, setAddOpen] = useState(false);

  async function handleRemove(campaign: ClientCampaignLink) {
    try {
      await unlink.mutateAsync({ campaignId: campaign.id, clientId });
      toast.success(`${campaign.name} removed from client`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove campaign');
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Campaigns</CardTitle>
            <CardDescription>
              {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} linked to this client
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            Add Campaign
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns linked"
              description='No campaigns are linked to this client yet. Click "Add Campaign" above to link one.'
              size="compact"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Vertical</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Cost per lead</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{c.vertical}</TableCell>
                    <TableCell>
                      <Badge className={`capitalize text-xs ${campaignStatusColors[c.status] || ''}`}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.costPerLead != null
                        ? formatCurrency(c.costPerLead)
                        : <span className="text-muted-foreground text-xs">default</span>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${c.name}`}
                        disabled={unlink.isPending}
                        onClick={() => handleRemove(c)}
                      >
                        <Trash2 className="size-4 text-negative" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddCampaignDialog clientId={clientId} open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

// ─── Invoices tab (per-client Xero/Stato invoices) ─────────────────────────
//
// Sam's Loom #30: "I don't get why there is no invoices for this client".
// Before, this tab was a stub linking off to /finance/invoices. Now it pulls
// /api/v1/clients/:id/invoices and renders a proper table.

const invoiceStatusColors: Record<string, string> = {
  draft: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
  sent: 'bg-info/10 text-info border-info/30',
  authorised: 'bg-info/10 text-info border-info/30',
  paid: 'bg-positive/10 text-positive border-positive/30',
  overdue: 'bg-negative/10 text-negative border-negative/30',
};

// ─── Filter / sort options for the per-client Invoices tab ────────────────
// P8: Sam asked for "filter by overdue, date" and "due date / issue date
// ordering" on the client detail page. Controls live inside InvoicesTab so
// they don't pollute InvoicesTable (which still just renders what it receives).

type InvoiceFilterStatus = 'all' | 'due' | 'overdue' | 'authorised' | 'paid' | 'draft';
type InvoiceSortKey =
  | 'issue_desc'
  | 'issue_asc'
  | 'due_asc'
  | 'due_desc'
  | 'amount_desc'
  | 'amount_asc';

const SELECT_CLASS =
  'flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export function applyFilterSort(
  invoices: InvoiceSummary[],
  filter: InvoiceFilterStatus,
  sort: InvoiceSortKey,
): InvoiceSummary[] {
  const now = Date.now();

  // Filter
  let filtered = invoices;
  if (filter !== 'all') {
    filtered = invoices.filter((inv) => {
      if (filter === 'overdue') {
        return inv.status === 'authorised' && new Date(inv.dueDate).getTime() < now;
      }
      if (filter === 'due') {
        // "Due" = authorised and not yet past due date
        return inv.status === 'authorised' && new Date(inv.dueDate).getTime() >= now;
      }
      return inv.status.toLowerCase() === filter;
    });
  }

  // Sort — spread to avoid mutating the query cache reference
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (sort) {
      case 'issue_desc': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'issue_asc':  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'due_asc':    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      case 'due_desc':   return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      case 'amount_desc': return toMoney(b.total) - toMoney(a.total);
      case 'amount_asc':  return toMoney(a.total) - toMoney(b.total);
      default: return 0;
    }
  });
  return sorted;
}

function InvoicesTab({ clientId, clientCurrency, totalRevenue }: { clientId: string; clientCurrency: string; totalRevenue: number }) {
  const { data, isLoading, isError } = useClientInvoices(clientId);
  const sync = useSyncClientInvoices(clientId);
  const invoices = data?.invoices ?? [];

  const [filterStatus, setFilterStatus] = useState<InvoiceFilterStatus>('all');
  const [sortKey, setSortKey] = useState<InvoiceSortKey>('issue_desc');

  const visibleInvoices = applyFilterSort(invoices, filterStatus, sortKey);

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
          <>
            {/* P8 filter/sort controls */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <select
                aria-label="Filter by status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as InvoiceFilterStatus)}
                className={SELECT_CLASS}
              >
                <option value="all">All</option>
                <option value="due">Due</option>
                <option value="overdue">Overdue</option>
                <option value="authorised">Authorised</option>
                <option value="paid">Paid</option>
                <option value="draft">Draft</option>
              </select>
              <select
                aria-label="Sort invoices"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as InvoiceSortKey)}
                className={SELECT_CLASS}
              >
                <option value="issue_desc">Issue date (newest first)</option>
                <option value="issue_asc">Issue date (oldest first)</option>
                <option value="due_asc">Due date (soonest first)</option>
                <option value="due_desc">Due date (latest first)</option>
                <option value="amount_desc">Amount (high to low)</option>
                <option value="amount_asc">Amount (low to high)</option>
              </select>
              {filterStatus !== 'all' && (
                <span className="text-xs text-muted-foreground">
                  {visibleInvoices.length} of {invoices.length} shown
                </span>
              )}
            </div>
            {visibleInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No invoices match the selected filter.</p>
            ) : (
              <InvoicesTable invoices={visibleInvoices} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function InvoicesTable({ invoices }: { invoices: InvoiceSummary[] }) {
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
                <div className="flex flex-wrap items-center gap-1">
                  <Badge className={`capitalize text-xs ${invoiceStatusColors[inv.status] || ''}`}>{inv.status}</Badge>
                  {/* P8 — Sam's "this one's overdue but it says authorized" complaint.
                      Show an inline Overdue badge when the invoice is past due AND still
                      has an authorised (not paid) status, so Sam sees it at a glance. */}
                  {inv.status === 'authorised' && new Date(inv.dueDate).getTime() < Date.now() && (
                    <Badge className="bg-negative/10 text-negative border-negative/30 text-xs">Overdue</Badge>
                  )}
                </div>
              </td>
              <td className="py-3 px-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
              <td className="py-3 px-3 text-right tabular-nums font-medium">
                {formatCurrency(toMoney(inv.total), inv.currency)}
              </td>
              <td className="py-3 px-3 text-right">
                {inv.daysOverdue > 0 ? (
                  <Badge className="bg-negative/10 text-negative border-negative/30 text-xs">
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
      logError('Save document metadata failed', err);
      toast.error('Uploaded to storage, but failed to save document record');
    }
  };

  const handleDownload = async (doc: ClientDocument) => {
    try {
      setDownloadingId(doc.id);
      const url = await fetchFreshDownloadUrl(doc.folder as UploadFolder, doc.r2Key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to generate download link');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRemove = async (doc: ClientDocument) => {
    try {
      await removeDoc.mutateAsync(doc.id);
      toast.success('Document removed');
    } catch (err) {
      logError('Remove failed', err);
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

// ─── Emails tab (L #33 — full email-thread integration) ───────────────────
// Reads /api/v1/clients/:id/emails. Outbound rows are auto-logged from the
// Resend send paths; inbound rows are manually logged via this UI for now
// (a future IMAP/Gmail integration is XL-deferred).
function EmailsTab({ clientId }: { clientId: string }) {
  const { data: emails, isLoading } = useClientEmails(clientId);
  const logEmail = useLogClientEmail(clientId);
  const deleteEmail = useDeleteClientEmail(clientId);

  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [bodyText, setBodyText] = useState('');

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() && !bodyText.trim()) {
      toast.error('Subject or body required');
      return;
    }
    try {
      await logEmail.mutateAsync({
        direction: 'inbound',
        subject: subject.trim() || undefined,
        body: bodyText.trim() || undefined,
        fromAddress: fromAddress.trim() || undefined,
      });
      setSubject('');
      setFromAddress('');
      setBodyText('');
      setFormOpen(false);
      toast.success('Inbound email logged');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log email');
    }
  };

  const handleDelete = async (email: ClientEmail) => {
    try {
      await deleteEmail.mutateAsync(email.id);
      toast.info('Email removed from thread');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Email thread</CardTitle>
            <CardDescription>
              {emails?.length ?? 0} email{(emails?.length ?? 0) === 1 ? '' : 's'} on file ·
              outbound rows are auto-logged when Stato sends mail for this client.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setFormOpen((v) => !v)}>
            <Plus className="size-4 mr-1.5" />
            Log inbound email
          </Button>
        </CardHeader>
        {formOpen && (
          <CardContent>
            <form onSubmit={handleLog} className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  placeholder="From (sender email)"
                />
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                />
              </div>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Paste the email body..."
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setFormOpen(false)} disabled={logEmail.isPending}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={logEmail.isPending}>
                  {logEmail.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                  Save
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-32" /></CardContent></Card>
      ) : !emails || emails.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Mail}
              title="No emails yet"
              description="Log an inbound email or wait for the next outbound Stato send to populate this thread."
              size="compact"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {emails.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                      e.direction === 'inbound' ? 'bg-positive/10 text-positive' : 'bg-info/10 text-info'
                    }`}>
                      {e.direction === 'inbound' ? <Inbox className="size-4" /> : <Send className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.subject || '(no subject)'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {e.direction === 'inbound' ? `From ${e.fromAddress || 'unknown'}` : `To ${e.toAddress || 'unknown'}`}
                        {' · '}
                        {new Date(e.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className={`text-xs capitalize ${
                      e.direction === 'inbound' ? 'bg-positive/10 text-positive border-positive/30' : 'bg-info/10 text-info border-info/30'
                    }`}>{e.direction}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(e)} aria-label="Remove from thread">
                      <Trash2 className="size-4 text-negative" />
                    </Button>
                  </div>
                </div>
                {e.body && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2 border-t pt-2">{e.body}</p>
                )}
                {e.resendEvent && (
                  <p className="text-xs text-muted-foreground">
                    Delivery: <span className="capitalize">{e.resendEvent}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity tab (L #38 — full activity feed) ────────────────────────────
function describeClientActivity(ev: ClientActivityEvent): string {
  const who = ev.actorName || 'Someone';
  const p = ev.payload as Record<string, unknown> | null;
  switch (ev.eventType) {
    case 'client_created':           return `${who} created the client`;
    case 'client_updated':           return `${who} updated ${(p?.changed as string[] | undefined)?.join(', ') || 'the client'}`;
    case 'contact_added':            return `${who} added a contact`;
    case 'contact_removed':          return `${who} removed a contact`;
    case 'document_uploaded':        return `${who} uploaded "${p?.name ?? ''}"`;
    case 'document_removed':         return `${who} removed "${p?.name ?? ''}"`;
    case 'agreement_sent':           return `${who} sent an agreement`;
    case 'agreement_signed':         return 'Agreement signed';
    case 'agreement_declined':       return 'Agreement declined';
    case 'agreement_status_changed': return `Agreement status: ${p?.status ?? '?'}`;
    case 'credit_check_run': {
      const score = p?.creditScore ?? '?';
      const change = p?.scoreChange as number | null | undefined;
      const delta = change != null ? ` (${change >= 0 ? '+' : ''}${change})` : '';
      return `${who} ran a credit check — score ${score}${delta}`;
    }
    case 'email_logged_inbound':     return `${who} logged inbound email "${p?.subject ?? ''}"`;
    case 'email_logged_outbound':    return `Stato sent "${p?.subject ?? ''}"`;
    case 'email_removed':            return `${who} removed email "${p?.subject ?? ''}"`;
    case 'invoice_synced':           return `${who} synced invoices from Xero`;
    default:                         return `${who} · ${ev.eventType}`;
  }
}

function ActivityTab({ clientId }: { clientId: string }) {
  const { data: events, isLoading } = useClientActivity(clientId, { limit: 100 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ActivityIcon className="size-4" />
          Activity timeline
        </CardTitle>
        <CardDescription>Everything that happened to this client, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !events || events.length === 0 ? (
          <EmptyState
            icon={ActivityIcon}
            title="No activity yet"
            description="Events appear here as you create documents, agreements, credit checks, emails, and more."
            size="compact"
          />
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-4">
            {events.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[19px] top-1.5 size-2 rounded-full bg-muted-foreground/40" />
                <p className="text-sm leading-tight">{describeClientActivity(ev)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(ev.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

