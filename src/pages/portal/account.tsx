import { useState } from 'react';
import { User, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// Portal users land with a temp password set by staff at provisioning time.
// This page exposes the existing /api/v1/auth/change-password endpoint so they
// can self-rotate. Restyled to the Statto design (Stato Portal.html → account).

export function PortalAccountPage() {
  usePageTitle('Stato — Account');
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('New password and confirmation do not match'); return; }
    if (newPassword === currentPassword) { toast.error('New password must be different from the current one'); return; }
    setPending(true);
    try {
      await api.post('/api/v1/auth/change-password', { currentPassword, newPassword });
      toast.success('Password updated. Please log in again.');
      setTimeout(() => logout(), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPending(false);
    }
  };

  const canSubmit = !pending && currentPassword && newPassword && confirmPassword;

  return (
    <div className="screen">
      <div className="card pad">
        <h3 className="statto-title acct-sec-h"><span className="lic"><User className="size-[18px]" /></span> Profile</h3>
        <p className="lc-sub" style={{ marginBottom: 6 }}>The email + name you signed in with.</p>
        <div className="acct-rows">
          <div className="acct-row"><span className="acct-l">Email</span><span className="acct-rv">{user?.email ?? '—'}</span></div>
          <div className="acct-row"><span className="acct-l">Name</span><span className="acct-rv">{user?.name ?? '—'}</span></div>
        </div>
      </div>

      <div className="card pad">
        <h3 className="statto-title acct-sec-h"><span className="lic"><KeyRound className="size-[18px]" /></span> Change password</h3>
        <p className="lc-sub" style={{ marginBottom: 20 }}>You'll be signed out after the change so you can log back in with the new password.</p>
        <form onSubmit={handleSubmit} className="acct-pw">
          <div className="acct-field">
            <label className="acct-pw-l" htmlFor="current-password">Current password</label>
            <input id="current-password" className="acct-input" type="password" autoComplete="current-password"
              value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="acct-field">
            <label className="acct-pw-l" htmlFor="new-password">New password</label>
            <input id="new-password" className="acct-input" type="password" autoComplete="new-password" minLength={8}
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <span className="acct-hint">At least 8 characters.</span>
          </div>
          <div className="acct-field">
            <label className="acct-pw-l" htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" className="acct-input" type="password" autoComplete="new-password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn b-dark b-sm acct-pw-btn" disabled={!canSubmit}>
            {pending ? <><Loader2 className="size-[15px] animate-spin" /> Updating…</> : <><KeyRound className="size-[15px]" /> Update password</>}
          </button>
        </form>
      </div>
    </div>
  );
}
