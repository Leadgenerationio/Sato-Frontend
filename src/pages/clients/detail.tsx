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
} from 'lucide-react';
import { toast } from 'sonner';
import { useClient, useCreditHistory, useRunCreditCheck } from '@/lib/hooks/use-clients';

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
    try {
      const result = await runCheck.mutateAsync(id!);
      toast.success(`Credit check complete — score: ${result.creditScore}`);
    } catch {
      toast.error('Credit check failed');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/clients"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <div className="flex-1">
          <PageHeader title={client.companyName} description={`${client.contactName} · ${client.companyNumber}`}>
            <Badge className={`capitalize ${statusColors[client.status] || ''}`}>{client.status}</Badge>
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
                <p className="text-sm text-muted-foreground">No active campaigns for this client.</p>
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
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className={`text-4xl font-bold tabular-nums ${client.creditScore >= 65 ? 'text-emerald-600' : client.creditScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {client.creditScore}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Credit Score</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className={`text-lg font-semibold capitalize ${riskColors[client.creditRiskRating || ''] || ''}`}>
                    {(client.creditRiskRating || '').replace('_', ' ')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Risk Rating</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
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
                <p className="text-sm text-muted-foreground py-4">No credit history. Run a credit check to start tracking.</p>
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
      </Tabs>
    </div>
  );
}
