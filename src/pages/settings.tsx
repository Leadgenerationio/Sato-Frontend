import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { api } from '@/lib/api';
import { ProfileSkeleton } from '@/components/shared/loading-skeleton';
import { User, Mail, Shield, Building, Calendar, LogOut, Loader2, CheckCircle2, XCircle, RefreshCw, Send, FileSignature, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { UsersManagement } from '@/pages/users';

import { logError, logWarn } from '../lib/log';

const SETTINGS_TABS = ['profile', 'account', 'integrations', 'users'] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];
const TAB_LABELS: Record<SettingsTab, string> = {
  profile: 'Profile',
  account: 'Account',
  integrations: 'Integrations',
  users: 'User Management',
};

function ProfileField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
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

// Loading shell shared by the integration cards while their status fetches.
function IntegrationLoading() {
  return (
    <div className="card pad acard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <Loader2 className="size-5 animate-spin" style={{ color: 'var(--fg3)' }} />
    </div>
  );
}

interface XeroStatus {
  connected: boolean;
  configured: boolean;
  tenantId?: string;
  tenantName?: string;
  expiresAt?: string;
}

function XeroIntegration() {
  // OCT-53: settings.tsx is the only surface in this codebase where the
  // literal env-var names stay legal — but ONLY for the owner, who is
  // typically the deploy admin and needs the exact key to set in their
  // hosting environment. finance_admin / ops_manager see the opacified
  // "ask your administrator" copy because they can't act on env-vars
  // anyway. The regression test in env-var-leak-regression.test.ts
  // allow-lists settings.tsx explicitly for this exact reason.
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchStatus() {
    try {
      const res = await api.get<XeroStatus>('/api/v1/integrations/xero/status');
      setStatus(res.data ?? null);
    } catch (err) {
      logWarn('xero status fetch failed', err);
      setStatus({ connected: false, configured: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) return <IntegrationLoading />;

  return (
    <div className="card pad acard">
      <div className="set-intg-head">
        <span className="set-intg-ic blue">X</span>
        <div className="set-intg-name-wrap">
          <div className="set-intg-name">Xero</div>
          <div className="set-intg-desc">Accounting and invoicing · Custom Connection</div>
        </div>
        {status?.connected ? (
          <span className="pill p-pos set-intg-status"><CheckCircle2 className="size-3" strokeWidth={2.4} /> Connected</span>
        ) : (
          <span className="pill p-gray set-intg-status"><XCircle className="size-3" strokeWidth={2.4} /> Not connected</span>
        )}
      </div>
      {!status?.configured ? (
        isOwner ? (
          <p className="set-intg-note">
            Xero credentials are not configured on the server. Set <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--gray-100)', color: 'var(--fg1)' }}>XERO_CLIENT_ID</code> and <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--gray-100)', color: 'var(--fg1)' }}>XERO_CLIENT_SECRET</code> in the backend environment.
          </p>
        ) : (
          <p className="set-intg-note">
            Xero credentials are not configured on the server. Ask your administrator to add the Xero Custom Connection credentials to the backend configuration.
          </p>
        )
      ) : status?.connected ? (
        <>
          {status.tenantName && (
            <div className="set-intg-row">
              <Building className="size-4" />
              Organisation: <strong>{status.tenantName}</strong>
            </div>
          )}
          {status.tenantId && (
            <div className="set-intg-tenant">Tenant ID: <code>{status.tenantId}</code></div>
          )}
          <p className="set-intg-note">
            Connected via Xero Custom Connection (server-to-server). Tokens renew automatically every 30 minutes.
          </p>
        </>
      ) : (
        <p className="set-intg-note">
          Xero credentials are set but authentication failed. Check the backend log for details.
        </p>
      )}
    </div>
  );
}

interface LeadByteStatus {
  configured: boolean;
  lastSyncAt: string | null;
}

function LeadByteIntegration() {
  // OCT-53: same role-gating as XeroIntegration — owner sees the literal
  // env-var name (they deploy and set it), other roles see the opacified
  // hand-off copy.
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [status, setStatus] = useState<LeadByteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function fetchStatus() {
    try {
      const res = await api.get<LeadByteStatus>('/api/v1/integrations/leadbyte/status');
      setStatus(res.data ?? null);
    } catch (err) {
      logWarn('leadbyte status fetch failed', err);
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
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to enqueue sync');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <IntegrationLoading />;

  const hasApiKey = status?.configured ?? false;
  const lastSync = status?.lastSyncAt ?? null;

  return (
    <div className="card pad acard">
      <div className="set-intg-head">
        <span className="set-intg-ic orange">L</span>
        <div className="set-intg-name-wrap">
          <div className="set-intg-name">LeadByte</div>
          <div className="set-intg-desc">Lead management and distribution</div>
        </div>
        {hasApiKey ? (
          <span className="pill p-pos set-intg-status"><CheckCircle2 className="size-3" strokeWidth={2.4} /> Connected</span>
        ) : (
          <span className="pill p-warn set-intg-status">Mock mode</span>
        )}
      </div>
      {hasApiKey ? (
        <>
          {lastSync ? (
            <div className="set-intg-row">
              <Calendar className="size-4" />
              Last sync: {new Date(lastSync).toLocaleString()}
            </div>
          ) : (
            <div className="set-intg-row">
              <Calendar className="size-4" />
              No sync run yet
            </div>
          )}
          <p className="set-intg-note">
            Leads are synced hourly from LeadByte via API.
          </p>
          <button className="btn b-ghost b-sm" style={{ marginTop: 14 }} onClick={handleRefreshNow} disabled={syncing}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-[15px]" />}
            Refresh Now
          </button>
        </>
      ) : isOwner ? (
        <p className="set-intg-note">
          Running in mock mode with sample data. Set <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--gray-100)', color: 'var(--fg1)' }}>LEADBYTE_API_KEY</code> in the backend environment to connect to LeadByte and enable hourly lead sync.
        </p>
      ) : (
        <p className="set-intg-note">
          Running in mock mode with sample data. Ask your administrator to add the LeadByte API key to the backend configuration to connect LeadByte and enable hourly lead sync.
        </p>
      )}
    </div>
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
      } catch (err) {
        logWarn('credit-check status fetch failed', err);
        setStatus({ provider: 'mock', configured: false, checksRun: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <IntegrationLoading />;

  const provider = status?.provider ?? 'mock';
  const creditChecksRun = status?.checksRun ?? 0;

  const providerLabel = provider === 'creditsafe' ? 'Creditsafe' : provider === 'endole' ? 'Endole' : 'Mock';
  const isLive = provider !== 'mock';

  return (
    <div className="card pad acard">
      <div className="set-intg-head">
        <span className="set-intg-ic purple">{providerLabel[0]}</span>
        <div className="set-intg-name-wrap">
          <div className="set-intg-name">Credit Checks — {providerLabel}</div>
          <div className="set-intg-desc">Company credit scoring and CCJ data</div>
        </div>
        {isLive ? (
          <span className="pill p-pos set-intg-status"><CheckCircle2 className="size-3" strokeWidth={2.4} /> Connected</span>
        ) : (
          <span className="pill p-warn set-intg-status">Mock mode</span>
        )}
      </div>
      {isLive ? (
        <>
          <div className="set-intg-row">
            <Shield className="size-4" />
            Credit checks run: <strong>{creditChecksRun}</strong>
          </div>
          <p className="set-intg-note">
            {providerLabel} API is active. Credit checks are performed on demand for buyer verification.
          </p>
        </>
      ) : (
        <p className="set-intg-note">
          Running in mock mode. Auto-selects provider on backend: <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--gray-100)', color: 'var(--fg1)' }}>CREDITSAFE_API_KEY</code> (preferred) or <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--gray-100)', color: 'var(--fg1)' }}>ENDOLE_API_KEY</code>.
        </p>
      )}
    </div>
  );
}

interface ResendStatus { configured: boolean; fromEmail: string | null; fromName: string | null; }
interface SignNowStatus { configured: boolean; baseUrl: string | null; username: string | null; sandbox: boolean; }
interface R2Status { configured: boolean; bucket: string | null; publicBaseUrl: string | null; }
interface CatchrStatus { configured: boolean; mcpUrl: string | null; lastSyncAt: string | null; }

// `.set-intg-ic` ships blue/orange/purple in admin-screens.css; green is
// applied inline so SignNow / Banking get the positive tint without a new
// CSS rule.
type SetIntgTint = 'blue' | 'orange' | 'purple' | 'green';
const greenTintStyle = { background: 'var(--positive-bg)', color: 'var(--positive)' };

function SimpleIntegrationCard<T extends { configured: boolean }>({
  title, description, icon: Icon, tint, endpoint, envHint, renderDetails,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  tint: SetIntgTint;
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
      } catch (err) {
        logWarn('integration status fetch failed', err);
        setData({ configured: false } as T);
      } finally {
        setLoading(false);
      }
    })();
  }, [endpoint]);

  if (loading) return <IntegrationLoading />;

  const isConnected = data?.configured ?? false;

  return (
    <div className="card pad acard">
      <div className="set-intg-head">
        <span className={`set-intg-ic ${tint}`} style={tint === 'green' ? greenTintStyle : undefined}><Icon className="size-5" /></span>
        <div className="set-intg-name-wrap">
          <div className="set-intg-name">{title}</div>
          <div className="set-intg-desc">{description}</div>
        </div>
        {isConnected ? (
          <span className="pill p-pos set-intg-status"><CheckCircle2 className="size-3" strokeWidth={2.4} /> Connected</span>
        ) : (
          <span className="pill p-warn set-intg-status"><XCircle className="size-3" strokeWidth={2.4} /> Not configured</span>
        )}
      </div>
      {isConnected && data && renderDetails?.(data)}
      {!isConnected && (
        <p className="set-intg-note">
          Add <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--gray-100)', color: 'var(--fg1)' }}>{envHint}</code> to the backend environment to enable this integration.
        </p>
      )}
    </div>
  );
}

function ResendIntegration() {
  return (
    <SimpleIntegrationCard<ResendStatus>
      title="Resend"
      description="Transactional email (invoices, notifications)"
      icon={Send}
      tint="purple"
      endpoint="/api/v1/integrations/resend/status"
      envHint="RESEND_API_KEY"
      renderDetails={(d) => (
        <>
          {d.fromEmail && (
            <div className="set-intg-row"><Mail className="size-4" />Sender: <code>{d.fromEmail}</code></div>
          )}
          {d.fromName && <div className="set-intg-tenant">Display name: {d.fromName}</div>}
          <p className="set-intg-note">Domain must be verified in Resend (SPF/DKIM records).</p>
        </>
      )}
    />
  );
}

function SignNowIntegration() {
  return (
    <SimpleIntegrationCard<SignNowStatus>
      title="SignNow"
      description="E-signature for client service agreements"
      icon={FileSignature}
      tint="green"
      endpoint="/api/v1/integrations/signnow/status"
      envHint="SIGNNOW_CLIENT_ID + SIGNNOW_CLIENT_SECRET + SIGNNOW_USERNAME + SIGNNOW_PASSWORD"
      renderDetails={(d) => (
        <>
          {d.username && (
            <div className="set-intg-row"><Shield className="size-4" />Service account: <code>{d.username}</code></div>
          )}
          {d.baseUrl && <div className="set-intg-tenant">API host: {d.baseUrl}{d.sandbox && ' (sandbox)'}</div>}
          <p className="set-intg-note">OAuth2 password grant; access tokens cached and refreshed automatically.</p>
        </>
      )}
    />
  );
}

function CatchrIntegration() {
  return (
    <SimpleIntegrationCard<CatchrStatus>
      title="Catchr"
      description="Multi-platform ad-spend (Google Ads, Facebook, LinkedIn, Bing, TikTok)"
      icon={HardDrive}
      tint="blue"
      endpoint="/api/v1/integrations/catchr/status"
      envHint="CATCHR_API_KEY + CATCHR_MCP_URL"
      renderDetails={(d) => (
        <>
          {d.mcpUrl && (
            <div className="set-intg-row"><Mail className="size-4" />MCP URL: <code>{d.mcpUrl}</code></div>
          )}
          {d.lastSyncAt && (
            <div className="set-intg-tenant">Last sync: {new Date(d.lastSyncAt).toLocaleString('en-GB')}</div>
          )}
          <p className="set-intg-note">Backend pulls fresh spend hourly at minute 5; data feeds Reports → Ad Spend.</p>
        </>
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
      tint="orange"
      endpoint="/api/v1/integrations/r2/status"
      envHint="R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET + R2_ACCOUNT_ID"
      renderDetails={(d) => (
        <>
          {d.bucket && (
            <div className="set-intg-row"><HardDrive className="size-4" />Bucket: <code>{d.bucket}</code></div>
          )}
          {d.publicBaseUrl && <div className="set-intg-tenant">Public base URL: {d.publicBaseUrl}</div>}
          <p className="set-intg-note">Signed upload/download URLs expire after 15 minutes / 1 hour respectively.</p>
        </>
      )}
    />
  );
}

function BankingIntegration() {
  return (
    <div className="card pad acard">
      <div className="set-intg-head">
        <span className="set-intg-ic green" style={greenTintStyle}>£</span>
        <div className="set-intg-name-wrap">
          <div className="set-intg-name">Banking</div>
          <div className="set-intg-desc">Bank balances via Xero bank feed</div>
        </div>
        <span className="pill p-pos set-intg-status"><CheckCircle2 className="size-3" strokeWidth={2.4} /> Via Xero</span>
      </div>
      <p className="set-intg-note">
        Phase 1 uses Xero's bank feed for balances and transactions — no separate Open Banking integration required. Direct Open Banking (e.g., TrueLayer) is deferred to Phase 2.
      </p>
    </div>
  );
}

export function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);
  const [tab, setTab] = useState<SettingsTab>('profile');

  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user?.name) setProfileName(user.name);
  }, [user?.name]);

  async function handleSaveProfile() {
    if (!user) return;
    const trimmed = profileName.trim();
    if (!trimmed) {
      toast.error('Name is required');
      return;
    }
    if (trimmed === user.name) {
      toast.info('No changes to save');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await api.patch<{ user: { name: string } }>('/api/v1/auth/me', { name: trimmed });
      if (res.data?.user) {
        updateUser({ name: res.data.user.name });
        toast.success('Profile updated');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      toast.error(message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword) {
      toast.error('Both current and new password are required');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('New password must differ from the current password');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.post('/api/v1/auth/change-password', { currentPassword, newPassword });
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      toast.error(message);
    } finally {
      setPasswordSaving(false);
    }
  }

  if (!user) return null;

  const isOwner = user.role === 'owner';
  // Hide owner-only tabs for non-owners; keep `tab` from landing on one.
  const visibleTabs = SETTINGS_TABS.filter((t) => isOwner || (t !== 'integrations' && t !== 'users'));
  const activeTab = visibleTabs.includes(tab) ? tab : 'profile';

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Settings</h1>
          <p className="ahead-sub">Manage your account and preferences</p>
        </div>
      </div>

      <div className="seg set-seg">
        {visibleTabs.map((t) => (
          <button
            key={t}
            className={'seg-btn' + (activeTab === t ? ' on' : '')}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        pageLoading ? <ProfileSkeleton /> : (
          <div className="card pad acard">
            <h3 className="statto-title">Profile</h3>
            <p className="ac-sub" style={{ marginTop: 4 }}>Your personal information</p>
            <div className="set-id">
              <span className="set-avatar">{initials}</span>
              <div>
                <div className="set-id-name">{user.name}</div>
                <div className="set-id-email">{user.email}</div>
                <span className="set-id-role" style={{ textTransform: 'capitalize' }}>{user.role.replace('_', ' ')}</span>
              </div>
            </div>
            <div className="set-fields">
              <ProfileField icon={User} label="Full Name" value={user.name} />
              <ProfileField icon={Mail} label="Email Address" value={user.email} />
              <ProfileField icon={Shield} label="Role" value={user.role.replace('_', ' ')} />
              <ProfileField icon={Building} label="Business ID" value={user.businessId || 'Not assigned'} />
              <ProfileField icon={Calendar} label="Account Status" value={user.isActive ? 'Active' : 'Inactive'} />
            </div>
          </div>
        )
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <>
          <div className="card pad acard">
            <h3 className="statto-title">Update Profile</h3>
            <p className="ac-sub" style={{ marginTop: 4, marginBottom: 18 }}>Change your display name</p>
            <div className="nc-grid2">
              <div className="nc-field">
                <label className="nc-label" htmlFor="name">Name</label>
                <input
                  id="name"
                  className="nc-input"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  disabled={profileSaving}
                />
              </div>
              <div className="nc-field">
                <label className="nc-label" htmlFor="email">Email</label>
                <input id="email" className="nc-input" defaultValue={user.email} disabled />
              </div>
            </div>
            <button className="btn b-dark b-sm" onClick={handleSaveProfile} disabled={profileSaving}>
              {profileSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save Changes
            </button>
          </div>

          <div className="card pad acard">
            <h3 className="statto-title">Change Password</h3>
            <p className="ac-sub" style={{ marginTop: 4, marginBottom: 18 }}>Update your account password</p>
            <div className="nc-grid2">
              <div className="nc-field">
                <label className="nc-label" htmlFor="current-password">Current Password</label>
                <input
                  id="current-password"
                  className="nc-input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={passwordSaving}
                />
              </div>
              <div className="nc-field">
                <label className="nc-label" htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  className="nc-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={passwordSaving}
                />
              </div>
            </div>
            <button className="btn b-dark b-sm" onClick={handleChangePassword} disabled={passwordSaving}>
              {passwordSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Update Password
            </button>
          </div>

          <div className="card pad acard set-danger">
            <h3 className="statto-title set-danger-h">Danger Zone</h3>
            <p className="ac-sub" style={{ marginTop: 4, marginBottom: 18 }}>Sign out of your account</p>
            <button className="btn set-signout" onClick={() => { logout(); toast.info('Signed out'); }}>
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        </>
      )}

      {/* Integrations Tab — owner only */}
      {isOwner && activeTab === 'integrations' && (
        <div className="set-intg-list">
          <XeroIntegration />
          <LeadByteIntegration />
          <CreditCheckIntegration />
          <ResendIntegration />
          <SignNowIntegration />
          <CatchrIntegration />
          <R2Integration />
          <BankingIntegration />
        </div>
      )}

      {/* User Management Tab — owner only */}
      {isOwner && activeTab === 'users' && <UsersManagement />}
    </div>
  );
}
