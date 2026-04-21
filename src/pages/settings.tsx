import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layouts/page-header';
import { ProfileSkeleton } from '@/components/shared/loading-skeleton';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Mail, Shield, Building, Calendar, LogOut, Link2, Unlink, Loader2, CheckCircle2, XCircle, RefreshCw, Send, FileSignature, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { UsersManagement } from '@/pages/users';

function ProfileField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

interface XeroStatus {
  connected: boolean;
  configured: boolean;
  tenantId?: string;
  expiresAt?: string;
}

function XeroIntegration() {
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  async function fetchStatus() {
    try {
      const res = await api.get<XeroStatus>('/api/v1/integrations/xero/status');
      setStatus(res.data ?? null);
    } catch {
      setStatus({ connected: false, configured: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (searchParams.get('xero') === 'connected') {
      toast.success('Xero connected successfully');
      searchParams.delete('xero');
      setSearchParams(searchParams, { replace: true });
      fetchStatus();
    }
  }, [searchParams]);

  async function handleConnect() {
    setActionLoading(true);
    try {
      const res = await api.get<{ url: string }>('/api/v1/integrations/xero/auth-url');
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch {
      toast.error('Failed to start Xero connection');
      setActionLoading(false);
    }
  }

  async function handleDisconnect() {
    setActionLoading(true);
    try {
      await api.post('/api/v1/integrations/xero/disconnect');
      toast.success('Xero disconnected');
      setStatus({ connected: false, configured: status?.configured ?? false });
    } catch {
      toast.error('Failed to disconnect Xero');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#13B5EA]/10">
              <span className="text-lg font-bold text-[#13B5EA]">X</span>
            </div>
            <div>
              <CardTitle className="text-base">Xero</CardTitle>
              <CardDescription>Accounting and invoicing</CardDescription>
            </div>
          </div>
          {status?.connected ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              <CheckCircle2 className="size-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircle className="size-3 mr-1" />
              Not connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.configured ? (
          <p className="text-sm text-muted-foreground">
            Xero credentials are not configured on the server. Set <code className="rounded bg-muted px-1 py-0.5 text-xs">XERO_CLIENT_ID</code> and <code className="rounded bg-muted px-1 py-0.5 text-xs">XERO_CLIENT_SECRET</code> in the backend environment.
          </p>
        ) : status?.connected ? (
          <>
            {status.tenantId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="size-4" />
                <span>Tenant ID: <code className="rounded bg-muted px-1 py-0.5 text-xs">{status.tenantId}</code></span>
              </div>
            )}
            {status.expiresAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="size-4" />
                <span>Token expires: {new Date(status.expiresAt).toLocaleString()}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Tokens auto-refresh before each API call. Disconnect to revoke access.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
              Disconnect Xero
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your Xero account to sync invoices, bank accounts, and contacts.
            </p>
            <Button size="sm" onClick={handleConnect} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Connect Xero
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface LeadByteStatus {
  configured: boolean;
  lastSyncAt: string | null;
}

function LeadByteIntegration() {
  const [status, setStatus] = useState<LeadByteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function fetchStatus() {
    try {
      const res = await api.get<LeadByteStatus>('/api/v1/integrations/leadbyte/status');
      setStatus(res.data ?? null);
    } catch {
      setStatus({ configured: false, lastSyncAt: null });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  async function handleRefreshNow() {
    setSyncing(true);
    try {
      await api.post('/api/v1/integrations/leadbyte/sync');
      toast.success('LeadByte sync enqueued — runs in a moment');
      setTimeout(fetchStatus, 2000);
    } catch {
      toast.error('Failed to enqueue sync');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasApiKey = status?.configured ?? false;
  const lastSync = status?.lastSyncAt ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#FF6B35]/10">
              <span className="text-lg font-bold text-[#FF6B35]">L</span>
            </div>
            <div>
              <CardTitle className="text-base">LeadByte</CardTitle>
              <CardDescription>Lead management and distribution</CardDescription>
            </div>
          </div>
          {hasApiKey ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              <CheckCircle2 className="size-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
              Mock mode
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasApiKey ? (
          <>
            {lastSync ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="size-4" />
                <span>Last sync: {new Date(lastSync).toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="size-4" />
                <span>No sync run yet</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Leads are synced hourly from LeadByte via API.
            </p>
            <Button size="sm" variant="outline" onClick={handleRefreshNow} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh Now
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Running in mock mode with sample data. Set <code className="rounded bg-muted px-1 py-0.5 text-xs">LEADBYTE_API_KEY</code> in the backend environment to connect to LeadByte and enable hourly lead sync.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface CreditCheckStatus {
  provider: 'creditsafe' | 'endole' | 'mock';
  configured: boolean;
  checksRun: number;
}

function CreditCheckIntegration() {
  const [status, setStatus] = useState<CreditCheckStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<CreditCheckStatus>('/api/v1/integrations/credit-check/status');
        setStatus(res.data ?? null);
      } catch {
        setStatus({ provider: 'mock', configured: false, checksRun: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const provider = status?.provider ?? 'mock';
  const creditChecksRun = status?.checksRun ?? 0;

  const providerLabel = provider === 'creditsafe' ? 'Creditsafe' : provider === 'endole' ? 'Endole' : 'Mock';
  const providerColor = provider === 'creditsafe' ? '#1f6feb' : provider === 'endole' ? '#2D3748' : '#737373';
  const isLive = provider !== 'mock';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg" style={{ background: `${providerColor}15` }}>
              <span className="text-lg font-bold" style={{ color: providerColor }}>{providerLabel[0]}</span>
            </div>
            <div>
              <CardTitle className="text-base">Credit Checks — {providerLabel}</CardTitle>
              <CardDescription>Company credit scoring and CCJ data</CardDescription>
            </div>
          </div>
          {isLive ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              <CheckCircle2 className="size-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
              Mock mode
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLive ? (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="size-4" />
              <span>Credit checks run: <strong>{creditChecksRun}</strong></span>
            </div>
            <p className="text-sm text-muted-foreground">
              {providerLabel} API is active. Credit checks are performed on demand for buyer verification.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Running in mock mode. Auto-selects provider on backend: <code className="rounded bg-muted px-1 py-0.5 text-xs">CREDITSAFE_API_KEY</code> (preferred) or <code className="rounded bg-muted px-1 py-0.5 text-xs">ENDOLE_API_KEY</code>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface ResendStatus { configured: boolean; fromEmail: string | null; fromName: string | null; }
interface DocuSignStatus { configured: boolean; accountId: string | null; oauthBase: string | null; }
interface R2Status { configured: boolean; bucket: string | null; publicBaseUrl: string | null; }

function SimpleIntegrationCard<T extends { configured: boolean }>({
  title, description, icon: Icon, iconColor, endpoint, envHint, renderDetails,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  endpoint: string;
  envHint: string;
  renderDetails?: (data: T) => React.ReactNode;
}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<T>(endpoint);
        setData((res.data as T) ?? null);
      } catch {
        setData({ configured: false } as T);
      } finally {
        setLoading(false);
      }
    })();
  }, [endpoint]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = data?.configured ?? false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg" style={{ background: `${iconColor}15` }}>
              <Icon className="size-5" style={{ color: iconColor }} />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          {isConnected ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              <CheckCircle2 className="size-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
              <XCircle className="size-3 mr-1" />
              Not configured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isConnected && data && renderDetails?.(data)}
        {!isConnected && (
          <p className="text-sm text-muted-foreground">
            Add <code className="rounded bg-muted px-1 py-0.5 text-xs">{envHint}</code> to the backend environment to enable this integration.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ResendIntegration() {
  return (
    <SimpleIntegrationCard<ResendStatus>
      title="Resend"
      description="Transactional email (invoices, notifications)"
      icon={Send}
      iconColor="#6366f1"
      endpoint="/api/v1/integrations/resend/status"
      envHint="RESEND_API_KEY"
      renderDetails={(d) => (
        <div className="space-y-1 text-sm text-muted-foreground">
          {d.fromEmail && (
            <div className="flex items-center gap-2"><Mail className="size-4" />Sender: <code className="rounded bg-muted px-1 py-0.5 text-xs">{d.fromEmail}</code></div>
          )}
          {d.fromName && <div className="text-xs">Display name: {d.fromName}</div>}
          <p className="text-xs">Domain must be verified in Resend (SPF/DKIM records).</p>
        </div>
      )}
    />
  );
}

function DocuSignIntegration() {
  return (
    <SimpleIntegrationCard<DocuSignStatus>
      title="DocuSign"
      description="E-signature for client service agreements"
      icon={FileSignature}
      iconColor="#ffcc22"
      endpoint="/api/v1/integrations/docusign/status"
      envHint="DOCUSIGN_INTEGRATION_KEY + DOCUSIGN_SECRET + DOCUSIGN_USER_ID + DOCUSIGN_ACCOUNT_ID"
      renderDetails={(d) => (
        <div className="space-y-1 text-sm text-muted-foreground">
          {d.accountId && (
            <div className="flex items-center gap-2"><Shield className="size-4" />Account: <code className="rounded bg-muted px-1 py-0.5 text-xs">{d.accountId}</code></div>
          )}
          {d.oauthBase && <div className="text-xs">OAuth host: {d.oauthBase}</div>}
          <p className="text-xs">JWT access tokens are cached and auto-refresh before each envelope request.</p>
        </div>
      )}
    />
  );
}

function R2Integration() {
  return (
    <SimpleIntegrationCard<R2Status>
      title="Cloudflare R2"
      description="File storage (agreements, creatives, invoices)"
      icon={HardDrive}
      iconColor="#f6821f"
      endpoint="/api/v1/integrations/r2/status"
      envHint="R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET + R2_ACCOUNT_ID"
      renderDetails={(d) => (
        <div className="space-y-1 text-sm text-muted-foreground">
          {d.bucket && (
            <div className="flex items-center gap-2"><HardDrive className="size-4" />Bucket: <code className="rounded bg-muted px-1 py-0.5 text-xs">{d.bucket}</code></div>
          )}
          {d.publicBaseUrl && <div className="text-xs truncate">Public base URL: {d.publicBaseUrl}</div>}
          <p className="text-xs">Signed upload/download URLs expire after 15 minutes / 1 hour respectively.</p>
        </div>
      )}
    />
  );
}

function BankingIntegration() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <span className="text-lg font-bold text-emerald-600">£</span>
            </div>
            <div>
              <CardTitle className="text-base">Banking</CardTitle>
              <CardDescription>Bank balances via Xero bank feed</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">
            <CheckCircle2 className="size-3 mr-1" />
            Via Xero
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Phase 1 uses Xero's bank feed for balances and transactions — no separate Open Banking integration required. Direct Open Banking (e.g., TrueLayer) is deferred to Phase 2.
        </p>
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (!user) return null;

  const isOwner = user.role === 'owner';

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          {isOwner && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
          {isOwner && <TabsTrigger value="users">User Management</TabsTrigger>}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          {pageLoading ? <ProfileSkeleton /> : (
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <Avatar size="lg" className="size-20">
                  <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg font-semibold">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <Badge variant="secondary" className="mt-2 capitalize">
                    {user.role.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
              <Separator className="my-6" />
              <div className="space-y-1">
                <ProfileField icon={User} label="Full Name" value={user.name} />
                <Separator />
                <ProfileField icon={Mail} label="Email Address" value={user.email} />
                <Separator />
                <ProfileField icon={Shield} label="Role" value={user.role.replace('_', ' ')} />
                <Separator />
                <ProfileField icon={Building} label="Business ID" value={user.businessId || 'Not assigned'} />
                <Separator />
                <ProfileField icon={Calendar} label="Account Status" value={user.isActive ? 'Active' : 'Inactive'} />
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Update Profile</CardTitle>
              <CardDescription>Change your display name</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" defaultValue={user.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" defaultValue={user.email} disabled />
                </div>
              </div>
              <Button size="sm">Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>
              </div>
              <Button size="sm">Update Password</Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Sign out of your account</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => { logout(); toast.info('Signed out'); }}>
                <LogOut className="size-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab — owner only */}
        {isOwner && (
          <TabsContent value="integrations" className="mt-6 space-y-6">
            <XeroIntegration />
            <LeadByteIntegration />
            <CreditCheckIntegration />
            <ResendIntegration />
            <DocuSignIntegration />
            <R2Integration />
            <BankingIntegration />
          </TabsContent>
        )}

        {/* User Management Tab — owner only */}
        {isOwner && (
          <TabsContent value="users" className="mt-6">
            <UsersManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
