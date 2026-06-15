import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Shield, FileText, Megaphone,
  PoundSterling, Calendar, ReceiptText, Tag, Workflow, ClipboardCheck, Loader2,
  TrendingDown, TrendingUp, AlertTriangle, Link2, Download, Trash2, FileSignature,
  Users, RefreshCw, Activity as ActivityIcon, Inbox, Send, Plus, ExternalLink,
  ChevronDown,
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
import { toMoney, type InvoiceSummary } from '@/lib/hooks/use-invoices';
import {
  useClientActivity, useClientEmails, useLogClientEmail, useDeleteClientEmail,
  type ClientActivityEvent, type ClientEmail,
} from '@/lib/hooks/use-client-activity';
import { FileUpload } from '@/components/shared/file-upload';
import { fetchFreshDownloadUrl, type UploadFolder } from '@/lib/hooks/use-uploads';
import { SendAgreementDialog } from '@/pages/agreements';
import { EditClientButton } from '@/components/clients/edit-client-dialog';

import { logError } from '../../lib/log';

// Statto pill variant per contact type.
const contactTypePill: Record<string, string> = {
  primary: 'infosoft',
  billing: 'pos',
  compliance: 'soft',
  other: 'gray',
};

// Sam Loom #31 (13 May response) — only 3 statuses surfaced. 'prospect'
// and 'paused' kept in the map for back-compat in case a legacy row
// slipped through 0022; would render with the closest visual.
const statusPill: Record<string, string> = {
  onboarding: 'infosoft',
  active: 'pos',
  churned: 'gray',
  // Legacy fallbacks — should be empty post-migration but kept for safety.
  prospect: 'infosoft',
  paused: 'warn',
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
    <div className="set-field">
      <span className="set-field-ic"><Icon className="size-[18px]" /></span>
      <div>
        <div className="set-field-l">{label}</div>
        <div className="set-field-v">{value}</div>
      </div>
    </div>
  );
}

const CLIENT_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'credit', label: 'Credit' },
  { value: 'documents', label: 'Documents' },
  { value: 'emails', label: 'Emails' },
  { value: 'activity', label: 'Activity' },
] as const;

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
  const [tab, setTab] = useState<(typeof CLIENT_TABS)[number]['value']>('overview');
  // Sam (27 May 2026 portal meeting): "this client is an existing client,
  // we've already signed an agreement, just not within this platform" —
  // admin override to flip agreementSigned without going through SignNow.
  const updateClient = useUpdateClient();
  // Sam ask 2026-06-15: admin needs the OPTION to switch a client's ad-spend
  // visibility on/off. clientType='managed' → client sees ad spend; 'ppl' →
  // hidden. The actual hiding is enforced server-side (getLeadsBySource); this
  // control just persists the editable type via the existing update mutation.
  const setClientType = async (clientType: 'managed' | 'ppl') => {
    if (!client) return;
    try {
      await updateClient.mutateAsync({ id: client.id, clientType });
      toast.success(
        clientType === 'managed'
          ? 'Client set to Managed — ad spend is now visible in their portal.'
          : 'Client set to Pay-per-lead — ad spend is hidden in their portal.',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update client type');
    }
  };
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
    return (
      <div className="screen-page">
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg2)' }}>Loading client…</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="screen-page">
        <div className="ph-screen">
          <span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span>
          <strong>Client not found</strong>
          <Link to="/clients"><button className="btn b-ghost b-sm"><ArrowLeft className="size-4" /> Back to clients</button></Link>
        </div>
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

  const displayed = resolveDisplayedStatus(client.status, client.agreementSigned, docsForStage?.length ?? 0);

  return (
    <div className="screen-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/clients"><button className="nc-back" title="Back to clients"><ArrowLeft className="size-5" /></button></Link>
          <div>
            <h1 className="ahead-title">{client.companyName}</h1>
            <p className="ahead-sub">{client.contactName} · {client.companyNumber}</p>
          </div>
        </div>
        <div className="page-actions">
          <span className={'pill p-' + (statusPill[displayed] ?? 'gray') + ' cl-status-pill'}>{statusLabels[displayed] ?? displayed}</span>
          <EditClientButton client={client} />
          {/* Sam request 2026-06-15: hide the "Create Agreement" button (hide,
              don't delete — flip to `true` to restore). The dialog itself is
              left mounted so the auto-open flow from /clients/create still
              works. */}
          {false && (
            <button className="btn b-dark b-sm" onClick={() => setAgreementDialogOpen(true)}>
              <FileSignature className="size-[15px]" /> Create Agreement
            </button>
          )}
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
        <div className="card pad acard" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderColor: 'var(--warning)' }}>
          <Link2 className="size-4" style={{ marginTop: 2, flexShrink: 0, color: 'var(--warning)' }} />
          <div style={{ flex: 1 }}>
            <p className="statto-title" style={{ fontSize: 14 }}>Not linked to Xero yet</p>
            <p className="ac-sub" style={{ marginTop: 4 }}>
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

      <div className="seg cl-detail-seg">
        {CLIENT_TABS.map((t) => (
          <button key={t.value} className={'seg-btn' + (tab === t.value ? ' on' : '')} onClick={() => setTab(t.value)}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="cl-overview">
          <div className="card pad acard">
            <h3 className="statto-title" style={{ marginBottom: 18 }}>Company Details</h3>
            <div className="set-fields">
              <InfoRow icon={Building2} label="Company" value={client.companyName} />
              <InfoRow icon={Mail} label="Email" value={client.contactEmail} />
              <InfoRow icon={Phone} label="Phone" value={client.contactPhone || '—'} />
              <InfoRow icon={MapPin} label="Address" value={formatAddress(client)} />
            </div>
          </div>
          <div className="card pad acard">
            <h3 className="statto-title" style={{ marginBottom: 18 }}>Billing</h3>
            <div className="set-fields">
              <InfoRow icon={PoundSterling} label="Currency" value={client.currency} />
              <InfoRow icon={Calendar} label="Payment Terms" value={`${client.paymentTermsDays} days`} />
              <InfoRow icon={ReceiptText} label="VAT Registered" value={client.vatRegistered ? 'Yes' : 'No'} />
              {client.vatRegistered && (
                <>
                  <InfoRow icon={ReceiptText} label="VAT Number" value={client.vatNumber || '—'} />
                  <InfoRow icon={ReceiptText} label="VAT Rate" value={`${client.vatRate}%`} />
                </>
              )}
              <InfoRow icon={Tag} label="Lead Price" value={formatCurrency(client.leadPrice, client.currency)} />
              <InfoRow icon={Workflow} label="Billing Workflow" value={client.billingWorkflow.replace('_', ' ')} />
            </div>

            {/* Sam ask 2026-06-15 — editable client type / ad-spend visibility. */}
            <div className="set-field" style={{ marginTop: 16, alignItems: 'flex-start' }}>
              <span className="set-field-ic"><Tag className="size-[18px]" /></span>
              <div style={{ flex: 1 }}>
                <label className="set-field-l" htmlFor="client-type-select">Client type / Ad-spend visibility</label>
                <div className="nc-select-wrap" style={{ marginTop: 6, maxWidth: 320 }}>
                  <select
                    id="client-type-select"
                    aria-label="Client type / Ad-spend visibility"
                    className="nc-select"
                    value={client.clientType ?? 'ppl'}
                    disabled={updateClient.isPending}
                    onChange={(e) => setClientType(e.target.value as 'managed' | 'ppl')}
                  >
                    <option value="managed">Managed (client sees ad spend)</option>
                    <option value="ppl">Pay-per-lead (ad spend hidden)</option>
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </div>
            </div>
          </div>

          <div className="card pad acard cl-ov-wide">
            <h3 className="statto-title">External System IDs</h3>
            <p className="ac-sub" style={{ marginTop: 4, marginBottom: 18 }}>How this client maps to LeadByte, the credit provider, and Xero</p>
            <div className="set-fields">
              {client.leadbyteClientId && (
                <InfoRow icon={Link2} label="LeadByte Client ID" value={client.leadbyteClientId} />
              )}
              <InfoRow icon={Link2} label="Companies House number" value={client.endoleCompanyId || 'Not linked'} />
              <InfoRow icon={Link2} label="Xero Contact ID" value={client.xeroContactId || 'Not linked'} />
            </div>
          </div>

          <div className="card pad acard cl-ov-wide">
            <h3 className="statto-title cl-sec-h"><Users className="size-[18px]" /> Contacts</h3>
            <p className="ac-sub" style={{ marginTop: 4, marginBottom: 18 }}>
              {client.contacts.length} contact{client.contacts.length !== 1 ? 's' : ''}
            </p>
            {client.contacts.length === 0 ? (
              <div className="cl-tab-empty">
                <span className="ph-screen-ic"><Users className="size-[26px]" /></span>
                <strong>No contacts</strong>
                <p>No contacts have been added to this client yet.</p>
              </div>
            ) : (
              <div className="set-fields" style={{ gap: 12 }}>
                {client.contacts.map((c) => (
                  <div key={c.id} className="cl-contact-card">
                    <div className="cl-contact-meta">
                      <div className="cl-contact-top">
                        <span className="cl-contact-name">{c.name}</span>
                        <span className={'pill p-' + (contactTypePill[c.contactType] ?? 'gray')} style={{ textTransform: 'capitalize' }}>{c.contactType}</span>
                      </div>
                      {c.role && <div className="cl-contact-role">{c.role}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      {c.email && <span className="cl-contact-email"><Mail className="size-[15px]" /> {c.email}</span>}
                      {c.phone && <span className="cl-contact-email"><Phone className="size-[15px]" /> {c.phone}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sam (27 May 2026 meeting): "we have multiple people that we
              need to provide access to this account." Adds the portal
              users management card to every client detail Overview tab. */}
          <PortalUsersCard clientId={client.id} clientName={client.companyName} />

          {client.notes && (
            <div className="card pad acard cl-ov-wide">
              <h3 className="statto-title" style={{ marginBottom: 12 }}>Notes</h3>
              <p className="ac-sub">{client.notes}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'campaigns' && <CampaignsTab clientId={id!} />}
      {tab === 'invoices' && <InvoicesTab clientId={id!} clientCurrency={client.currency} totalRevenue={client.totalRevenue} />}

      {tab === 'credit' && (
        <div className="screen-page" style={{ gap: 20 }}>
          <div className="cl-tab-head" style={{ padding: '0 2px' }}>
            <div>
              <h3 className="statto-title">Credit Score</h3>
              <p className="ac-sub" style={{ marginTop: 4 }}>
                {client.creditLastChecked ? `Last checked: ${formatDate(client.creditLastChecked)}` : 'Never checked'}
              </p>
            </div>
            <button className="btn b-dark b-sm" onClick={handleCreditCheck} disabled={runCheck.isPending}>
              {runCheck.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <Shield className="size-[15px]" />}
              Run Credit Check
            </button>
          </div>

          {client.creditScore !== null && (
            <div className="grid-3">
              <div className="card pad acard" style={{ textAlign: 'center' }}>
                <p className={`text-4xl font-bold tabular-nums ${client.creditScore >= 65 ? 'text-emerald-600' : client.creditScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {client.creditScore}
                </p>
                <p className="ac-sub" style={{ marginTop: 4 }}>Credit Score</p>
              </div>
              <div className="card pad acard" style={{ textAlign: 'center' }}>
                <p className={`text-lg font-semibold capitalize ${riskColors[client.creditRiskRating || ''] || ''}`}>
                  {(client.creditRiskRating || '').replace('_', ' ')}
                </p>
                <p className="ac-sub" style={{ marginTop: 4 }}>Risk Rating</p>
              </div>
              <div className="card pad acard" style={{ textAlign: 'center' }}>
                <p className="text-lg font-semibold">{client.activeCampaigns}</p>
                <p className="ac-sub" style={{ marginTop: 4 }}>Active Campaigns</p>
              </div>
            </div>
          )}

          <div className="card pad acard">
            <h3 className="statto-title">Credit History</h3>
            <p className="ac-sub" style={{ marginTop: 4 }}>Score changes over time</p>
            {creditLoading ? (
              <div style={{ padding: 16, color: 'var(--fg2)' }}>Loading…</div>
            ) : !creditHistory?.length ? (
              <div className="cl-tab-empty">
                <span className="ph-screen-ic"><Shield className="size-[26px]" /></span>
                <strong>No credit history</strong>
                <p>Run a credit check (button above) to record this client&apos;s score and track changes over time.</p>
              </div>
            ) : (
              <div className="set-fields" style={{ gap: 12, marginTop: 16 }}>
                {creditHistory.map((entry) => (
                  <div key={entry.id} className="cl-contact-card">
                    <div className="cl-contact-meta">
                      <div className="cl-contact-top">
                        <span className={`flex size-10 items-center justify-center rounded-lg ${entry.creditScore >= 65 ? 'bg-emerald-500/10' : entry.creditScore >= 50 ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
                          <span className={`text-sm font-bold tabular-nums ${entry.creditScore >= 65 ? 'text-emerald-600' : entry.creditScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {entry.creditScore}
                          </span>
                        </span>
                        <div>
                          <div className={`cl-contact-name capitalize ${riskColors[entry.riskRating] || ''}`}>{entry.riskRating.replace('_', ' ')} risk</div>
                          <div className="cl-contact-role">{formatDate(entry.checkedAt)}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {entry.ccjCount > 0 && (
                        <span className="pill p-neg"><AlertTriangle className="size-3" /> {entry.ccjCount} CCJ</span>
                      )}
                      {entry.scoreChange !== null && (
                        <span className={'pill p-' + (entry.scoreChange >= 0 ? 'pos' : 'neg')}>
                          {entry.scoreChange >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          {entry.scoreChange > 0 ? '+' : ''}{entry.scoreChange}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'documents' && <DocumentsTab clientId={id!} />}
      {tab === 'emails' && <EmailsTab clientId={id!} />}
      {tab === 'activity' && <ActivityTab clientId={id!} />}
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
    <div className="card pad acard">
      <div className="cl-ob-head">
        <div>
          <div className="cl-ob-lab">ONBOARDING</div>
          <div className="cl-ob-stage">
            Stage {currentIdx + 1} of {ONBOARDING_STEPS.length} · {ONBOARDING_STEPS[currentIdx]?.label ?? 'Unknown'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="cl-ob-agreement">
            <ClipboardCheck className="size-4" style={agreementSigned ? { color: 'var(--positive)' } : undefined} />
            Agreement: <strong>{agreementSigned ? 'Signed' : 'Not signed'}</strong>
          </span>
          {/* Sam (27 May 2026): admin override for clients who signed
              outside Stato — flips agreementSigned=true without going
              through SignNow. Only renders when not signed + a handler
              is provided. */}
          {!agreementSigned && onMarkAgreementSigned && (
            <button
              className="btn b-ghost b-sm"
              onClick={onMarkAgreementSigned}
              disabled={markAgreementPending}
            >
              {markAgreementPending
                ? <Loader2 className="size-3 animate-spin" />
                : <ClipboardCheck className="size-3" />}
              Mark as signed (external)
            </button>
          )}
        </div>
      </div>

      <div className="cl-stepper">
        {ONBOARDING_STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={step.key} className="cl-step">
              {i > 0 && <span className={'cl-step-line' + (isDone || isCurrent ? ' done' : '')} />}
              <span className={'cl-step-dot' + (isCurrent ? ' current' : isDone ? ' done' : '')} title={step.hint}>
                {isDone ? '✓' : i + 1}
              </span>
              <div className="cl-step-label">{step.label}</div>
              <div className="cl-step-sub">{step.hint}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Campaigns tab (P5 — inline list + Add Campaign dialog) ────────────────
//
// Sam's 12 May call: "how do we add a campaign here?". Was previously a stub
// linking off to /campaigns. Now shows the linked campaigns inline with a
// Remove button per row and an Add Campaign button that opens a dialog.

const campaignStatusPill: Record<string, string> = {
  active: 'pos',
  paused: 'warn',
  inactive: 'gray',
  archived: 'gray',
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
      <div className="card pad acard">
        <div className="cl-tab-head">
          <div>
            <h3 className="statto-title">Campaigns</h3>
            <p className="ac-sub" style={{ marginTop: 4 }}>
              {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} linked to this client
            </p>
          </div>
          <button className="btn b-dark b-sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-[15px]" /> Add Campaign
          </button>
        </div>
        {isLoading ? (
          <div style={{ padding: 16, color: 'var(--fg2)' }}>Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="cl-tab-empty">
            <span className="ph-screen-ic"><Megaphone className="size-[26px]" /></span>
            <strong>No campaigns linked</strong>
            <p>No campaigns are linked to this client yet. Click "Add Campaign" above to link one.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Vertical</th>
                  <th>Status</th>
                  <th className="r">Cost per lead</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="inv-id">{c.name}</td>
                    <td className="rpt-ncp" style={{ textTransform: 'capitalize' }}>{c.vertical || '—'}</td>
                    <td><span className={'pill p-' + (campaignStatusPill[c.status] ?? 'gray')} style={{ textTransform: 'capitalize' }}>{c.status}</span></td>
                    <td className="r" style={{ color: 'var(--fg2)' }}>
                      {c.costPerLead != null ? formatCurrency(c.costPerLead) : 'default'}
                    </td>
                    <td className="r">
                      <button
                        className="tk-del"
                        aria-label={`Remove ${c.name}`}
                        title="Unlink"
                        disabled={unlink.isPending}
                        onClick={() => handleRemove(c)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddCampaignDialog clientId={clientId} open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

// ─── Invoices tab (per-client Xero/Stato invoices) ─────────────────────────
//
// Sam's Loom #30: "I don't get why there is no invoices for this client".
// Before, this tab was a stub linking off to /finance/invoices. Now it pulls
// /api/v1/clients/:id/invoices and renders a proper table.

const invoiceStatusPill: Record<string, string> = {
  draft: 'gray',
  sent: 'infosoft',
  authorised: 'soft',
  paid: 'pos',
  overdue: 'neg',
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
    <div className="card pad acard">
      <div className="cl-tab-head">
        <div>
          <h3 className="statto-title">Invoices</h3>
          <p className="ac-sub" style={{ marginTop: 4 }}>
            {invoices.length === 0
              ? `Total revenue: ${formatCurrency(totalRevenue, clientCurrency)}`
              : `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} · Total revenue: ${formatCurrency(totalRevenue, clientCurrency)}`}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn b-ghost b-sm" onClick={handleSync} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <RefreshCw className="size-[15px]" />}
            Sync from Xero
          </button>
          <Link to={`/finance/invoices?client=${clientId}`}>
            <button className="btn b-ghost b-sm">
              <ExternalLink className="size-[15px]" /> Open in invoices list
            </button>
          </Link>
        </div>
      </div>
      {isLoading ? (
        <div style={{ padding: 16, color: 'var(--fg2)' }}>Loading…</div>
      ) : isError ? (
        <div className="cl-tab-empty">
          <span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span>
          <strong>Failed to load invoices</strong>
          <p>There was a problem loading invoices for this client. Refresh the page to try again.</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="cl-tab-empty">
          <span className="ph-screen-ic"><FileText className="size-[26px]" /></span>
          <strong>No invoices yet</strong>
          <p>No Stato invoices for this client. Click "Sync from Xero" above to pull invoices created directly in Xero, or "Open in invoices list" to create one.</p>
        </div>
      ) : (
        <>
          {/* P8 filter/sort controls */}
          <div className="cl-inv-filters">
            <div className="nc-select-wrap">
              <select
                aria-label="Filter by status"
                className="nc-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as InvoiceFilterStatus)}
              >
                <option value="all">All</option>
                <option value="due">Due</option>
                <option value="overdue">Overdue</option>
                <option value="authorised">Authorised</option>
                <option value="paid">Paid</option>
                {/* Sam request 2026-06-15: no drafts — removed the Draft filter
                    option so this tab can't surface drafts. Backend also
                    excludes them from the data. */}
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
            <div className="nc-select-wrap">
              <select
                aria-label="Sort invoices"
                className="nc-select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as InvoiceSortKey)}
              >
                <option value="issue_desc">Issue date (newest first)</option>
                <option value="issue_asc">Issue date (oldest first)</option>
                <option value="due_asc">Due date (soonest first)</option>
                <option value="due_desc">Due date (latest first)</option>
                <option value="amount_desc">Amount (high to low)</option>
                <option value="amount_asc">Amount (low to high)</option>
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
            {filterStatus !== 'all' && (
              <span className="ac-sub">{visibleInvoices.length} of {invoices.length} shown</span>
            )}
          </div>
          {visibleInvoices.length === 0 ? (
            <p className="ac-sub" style={{ padding: 16, textAlign: 'center' }}>No invoices match the selected filter.</p>
          ) : (
            <InvoicesTable invoices={visibleInvoices} />
          )}
        </>
      )}
    </div>
  );
}

export function InvoicesTable({ invoices }: { invoices: InvoiceSummary[] }) {
  return (
    <div className="table-scroll">
      <table className="inv-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Status</th>
            <th>Due</th>
            <th className="r">Amount</th>
            <th className="r">Overdue</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>
                <Link to={`/finance/invoices/${inv.id}`} className="inv-id" style={{ textDecoration: 'none' }}>
                  {inv.invoiceNumber || '—'}
                </Link>
                {inv.xeroInvoiceId && <div className="ri-date">Synced from Xero</div>}
              </td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                  <span className={'pill p-' + (invoiceStatusPill[inv.status] ?? 'gray')} style={{ textTransform: 'capitalize' }}>{inv.status}</span>
                  {/* P8 — Sam's "this one's overdue but it says authorized" complaint.
                      Show an inline Overdue badge when the invoice is past due AND still
                      has an authorised (not paid) status, so Sam sees it at a glance. */}
                  {inv.status === 'authorised' && new Date(inv.dueDate).getTime() < Date.now() && (
                    <span className="pill p-neg">Overdue</span>
                  )}
                </div>
              </td>
              <td className="inv-date">{formatDate(inv.dueDate)}</td>
              <td className="r mono inv-total">{formatCurrency(toMoney(inv.total), inv.currency)}</td>
              <td className="r">
                {inv.daysOverdue > 0 ? (
                  <span className="pill p-neg">{inv.daysOverdue}d</span>
                ) : (
                  <span className="rpt-ncp">—</span>
                )}
              </td>
              <td className="r">
                <Link to={`/finance/invoices/${inv.id}`} aria-label="Open invoice">
                  <button className="inv-open"><FileText className="size-4" /></button>
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
    <div className="card pad acard">
      <div className="cl-tab-head">
        <div>
          <h3 className="statto-title">Client Documents</h3>
          <p className="ac-sub" style={{ marginTop: 4 }}>
            Due-diligence documents, contracts, and other client files. Stored in Cloudflare R2.
          </p>
        </div>
        <FileUpload
          folder="misc"
          maxSizeMB={50}
          label="Upload document"
          onUploaded={handleUploaded}
        />
      </div>
      {isLoading ? (
        <div style={{ padding: 16, color: 'var(--fg2)' }}>Loading…</div>
      ) : docs.length === 0 ? (
        <div className="cl-tab-empty">
          <span className="ph-screen-ic"><FileText className="size-[26px]" /></span>
          <strong>No documents</strong>
          <p>Upload contracts, agreements, or compliance docs using the button above. Files are stored securely in Cloudflare R2.</p>
        </div>
      ) : (
        <div className="set-fields" style={{ gap: 8, marginTop: 16 }}>
          {docs.map((d) => (
            <div key={d.id} className="cl-contact-card">
              <div className="cl-contact-meta" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <span className="set-field-ic"><FileText className="size-4" /></span>
                <div>
                  <div className="cl-contact-name" title={d.name}>{d.name}</div>
                  <div className="cl-contact-role">{formatBytes(d.sizeBytes)} · uploaded {formatDate(d.createdAt)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="inv-open"
                  onClick={() => handleDownload(d)}
                  disabled={downloadingId === d.id}
                  aria-label="Download"
                >
                  {downloadingId === d.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                </button>
                <button
                  className="tk-del"
                  onClick={() => handleRemove(d)}
                  disabled={removeDoc.isPending}
                  aria-label="Remove from list"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div className="screen-page" style={{ gap: 20 }}>
      <div className="card pad acard">
        <div className="cl-tab-head" style={{ marginBottom: formOpen ? 18 : 0 }}>
          <div>
            <h3 className="statto-title">Email thread</h3>
            <p className="ac-sub" style={{ marginTop: 4 }}>
              {emails?.length ?? 0} email{(emails?.length ?? 0) === 1 ? '' : 's'} on file ·
              outbound rows are auto-logged when Stato sends mail for this client.
            </p>
          </div>
          <button className="btn b-ghost b-sm" onClick={() => setFormOpen((v) => !v)}>
            <Plus className="size-[15px]" /> Log inbound email
          </button>
        </div>
        {formOpen && (
          <form onSubmit={handleLog} className="cl-email-form">
            <div className="nc-grid2" style={{ marginBottom: 0 }}>
              <div className="nc-field">
                <input className="nc-input" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="From (sender email)" />
              </div>
              <div className="nc-field">
                <input className="nc-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
              </div>
            </div>
            <div className="nc-field">
              <textarea
                className="nc-textarea"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Paste the email body…"
                rows={4}
              />
            </div>
            <div className="ag-modal-foot" style={{ marginTop: 4 }}>
              <button type="button" className="btn b-ghost b-sm" onClick={() => setFormOpen(false)} disabled={logEmail.isPending}>Cancel</button>
              <button type="submit" className="btn b-dark b-sm" disabled={logEmail.isPending}>
                {logEmail.isPending ? <Loader2 className="size-[15px] animate-spin" /> : null}
                Save
              </button>
            </div>
          </form>
        )}
      </div>

      {isLoading ? (
        <div className="card pad acard"><div style={{ padding: 16, color: 'var(--fg2)' }}>Loading…</div></div>
      ) : !emails || emails.length === 0 ? (
        <div className="card acard cl-tab-empty" style={{ padding: '56px 24px' }}>
          <span className="ph-screen-ic"><Mail className="size-[26px]" /></span>
          <strong>No emails yet</strong>
          <p>Log an inbound email or wait for the next outbound Stato send to populate this thread.</p>
        </div>
      ) : (
        <div className="set-fields" style={{ gap: 12 }}>
          {emails.map((e) => (
            <div key={e.id} className="card pad acard">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    e.direction === 'inbound' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
                  }`}>
                    {e.direction === 'inbound' ? <Inbox className="size-4" /> : <Send className="size-4" />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="cl-contact-name">{e.subject || '(no subject)'}</div>
                    <div className="cl-contact-role">
                      {e.direction === 'inbound' ? `From ${e.fromAddress || 'unknown'}` : `To ${e.toAddress || 'unknown'}`}
                      {' · '}
                      {new Date(e.occurredAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className={'pill p-' + (e.direction === 'inbound' ? 'pos' : 'infosoft')} style={{ textTransform: 'capitalize' }}>{e.direction}</span>
                  <button className="tk-del" onClick={() => handleDelete(e)} aria-label="Remove from thread"><Trash2 className="size-4" /></button>
                </div>
              </div>
              {e.body && (
                <p className="ac-sub" style={{ marginTop: 8, whiteSpace: 'pre-wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>{e.body}</p>
              )}
              {e.resendEvent && (
                <p className="ac-sub" style={{ marginTop: 4 }}>Delivery: <span style={{ textTransform: 'capitalize' }}>{e.resendEvent}</span></p>
              )}
            </div>
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
    <div className="card pad acard">
      <h3 className="statto-title cl-sec-h"><ActivityIcon className="size-[18px]" /> Activity timeline</h3>
      <p className="ac-sub" style={{ marginTop: 4, marginBottom: 20 }}>Everything that happened to this client, newest first.</p>
      {isLoading ? (
        <div style={{ padding: 16, color: 'var(--fg2)' }}>Loading…</div>
      ) : !events || events.length === 0 ? (
        <div className="cl-tab-empty">
          <span className="ph-screen-ic"><ActivityIcon className="size-[26px]" /></span>
          <strong>No activity yet</strong>
          <p>Events appear here as you create documents, agreements, credit checks, emails, and more.</p>
        </div>
      ) : (
        <div className="cl-timeline">
          {events.map((ev) => (
            <div key={ev.id} className="cl-tl-item">
              <span className="cl-tl-dot" />
              <div className="cl-tl-body">
                <div className="cl-tl-text">{describeClientActivity(ev)}</div>
                <div className="cl-tl-time">
                  {new Date(ev.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
