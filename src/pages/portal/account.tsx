import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, KeyRound, User } from 'lucide-react';

// Portal users land with a temp password set by staff at provisioning time
// (POST /api/v1/users). Without a self-service change-password surface they
// either stay on the temp credential forever or need a staff round-trip to
// rotate. This page closes that gap by exposing the existing
// /api/v1/auth/change-password endpoint — same one the internal app uses,
// just mounted under /portal so client users can reach it.

export function PortalAccountPage() {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('New password must be different from the current one');
      return;
    }
    setPending(true);
    try {
      await api.post('/api/v1/auth/change-password', { currentPassword, newPassword });
      toast.success('Password updated. Please log in again.');
      // Force re-login so the new password is exercised end-to-end and any
      // session token tied to the old credential is rotated cleanly.
      setTimeout(() => logout(), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground">Manage your portal sign-in</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="size-4" />Profile
          </CardTitle>
          <CardDescription>The email + name you signed in with.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between border-b py-2">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email ?? '—'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{user?.name ?? '—'}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="size-4" />Change password
          </CardTitle>
          <CardDescription>
            You'll be signed out after the change so you can log back in with the new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 max-w-md">
            <div className="grid gap-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">At least 6 characters.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Button type="submit" disabled={pending || !currentPassword || !newPassword || !confirmPassword}>
                {pending ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" />Updating…</>
                ) : (
                  'Update password'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
