import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { UserPlus, Users, Mail, Loader2, ShieldCheck, ShieldOff, Crown, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { API_URL } from '@/lib/env';
import type { ApiResponse, UserRole } from '@/types';
import { logError } from '../../lib/log';

// Sam (27 May 2026 client-portal meeting): "we have multiple people that we
// need to provide access to this account." Adds a Portal Users card to the
// client detail Overview tab so Sam can spawn extra logins (role=client,
// clientId pre-set) without leaving the client page. Role-based tab access
// is a deferred follow-up — every portal user gets full access for now.

interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  clientId: string;
  clientName: string;
}

export function PortalUsersCard({ clientId, clientName }: Props) {
  const { token } = useAuth();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '' });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<{ users: PortalUser[] }> = await res.json();
      if (data.status === 'success' && data.data) {
        // BE doesn't filter — narrow to portal-role users (client OR
        // client_admin) tied to THIS client.
        setUsers(data.data.users.filter(
          (u) => (u.role === 'client' || u.role === 'client_admin') && u.clientId === clientId,
        ));
      }
    } catch (err) {
      logError('fetchPortalUsers failed', err);
    } finally {
      setLoading(false);
    }
  }, [token, clientId]);

  // Sam (2026-05-27 portal meeting): promote/demote a portal user
  // between role=client and role=client_admin. client_admin gains the
  // ability to manage portal users + upload externally-signed
  // agreement from inside /portal, so they don't have to go through Sam.
  const [promoting, setPromoting] = useState<string | null>(null);
  async function togglePromotion(user: PortalUser) {
    const nextRole: UserRole = user.role === 'client_admin' ? 'client' : 'client_admin';
    setPromoting(user.id);
    try {
      const res = await fetch(`${API_URL}/api/v1/users/${user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: nextRole }),
      });
      const data: ApiResponse<unknown> = await res.json();
      if (!res.ok || data.status !== 'success') {
        toast.error(data.message || 'Failed to change role');
        return;
      }
      toast.success(
        nextRole === 'client_admin'
          ? `${user.name} promoted — they can now manage portal users + upload agreement`
          : `${user.name} demoted to standard portal user`,
      );
      fetchUsers();
    } catch (err) {
      logError('togglePromotion failed', err);
      toast.error('Failed to change role');
    } finally {
      setPromoting(null);
    }
  }

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleAdd() {
    setAddError('');
    if (!addForm.name.trim() || !addForm.email.trim() || addForm.password.length < 6) {
      setAddError('Name + email + 6-character password are required.');
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: addForm.email.trim(),
          name: addForm.name.trim(),
          password: addForm.password,
          role: 'client',
          clientId,
        }),
      });
      const data: ApiResponse<{ user: PortalUser }> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setAddError(data.message || 'Failed to create portal user');
        setAddLoading(false);
        return;
      }
      toast.success(`Portal user added — ${addForm.email}`);
      setAddOpen(false);
      setAddForm({ name: '', email: '', password: '' });
      fetchUsers();
    } catch (err) {
      logError('createPortalUser failed', err);
      setAddError(err instanceof Error ? err.message : 'Failed to create portal user');
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <>
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4" />
                Portal users
              </CardTitle>
              <CardDescription>
                {users.length} login{users.length !== 1 ? 's' : ''} can access {clientName}'s portal
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="size-4 mr-1.5" />
              Add portal user
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No portal users yet"
              description="Add one to give this client login access at /portal."
              size="compact"
            />
          ) : (
            <div className="space-y-3">
              {users.map((u) => {
                const isAdmin = u.role === 'client_admin';
                return (
                <div
                  key={u.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{u.name}</p>
                      {isAdmin ? (
                        <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-xs">
                          <Crown className="size-3 mr-1" /> Client admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <UserIcon className="size-3 mr-1" /> Portal user
                        </Badge>
                      )}
                      {u.isActive ? (
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs">
                          <ShieldCheck className="size-3 mr-1" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <ShieldOff className="size-3 mr-1" /> Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="size-3" />
                      {u.email}
                    </div>
                  </div>
                  {/* Sam (2026-05-27): promote/demote toggle. Client admin
                      can self-serve user management + agreement upload
                      from inside /portal — the new client-side surface
                      designed in this round. */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => togglePromotion(u)}
                    disabled={promoting === u.id}
                    title={isAdmin ? 'Demote to standard portal user' : 'Promote to client admin'}
                  >
                    {promoting === u.id
                      ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                      : isAdmin
                        ? <UserIcon className="size-3.5 mr-1.5" />
                        : <Crown className="size-3.5 mr-1.5" />}
                    {isAdmin ? 'Demote' : 'Make admin'}
                  </Button>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add portal user</DialogTitle>
            <DialogDescription>
              Creates a login at <code>/portal</code> tied to{' '}
              <span className="font-medium">{clientName}</span>. Every portal user
              currently sees every tab — role-based access is a deferred follow-up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="pu-name">Name</Label>
              <Input
                id="pu-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Jamie Smith"
                disabled={addLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pu-email">Email</Label>
              <Input
                id="pu-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jamie@client.com"
                disabled={addLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pu-password">Initial password</Label>
              <Input
                id="pu-password"
                type="text"
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="At least 6 characters — share securely"
                disabled={addLoading}
              />
              <p className="text-xs text-muted-foreground">
                You'll need to send this to the user out-of-band — outbound email is still pending DNS.
              </p>
            </div>
            {addError && (
              <p className="text-sm text-red-600">{addError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={addLoading}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={addLoading}>
              {addLoading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <UserPlus className="size-4 mr-1.5" />}
              Add portal user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
