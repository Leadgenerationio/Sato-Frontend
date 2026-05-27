import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/shared/empty-state';
import { UserPlus, Users as UsersIcon, Mail, Loader2, Crown, User as UserIcon, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { API_URL } from '@/lib/env';
import type { ApiResponse } from '@/types';
import { logError } from '../../lib/log';

// Sam (2026-05-27 portal meeting): "The Client_admin should be able to do
// this, not Sam... everything is in the client portal." This is the
// client-side mirror of the admin Portal Users card — `client_admin` adds,
// lists, and (later) edits the portal logins for their own company without
// the agency touching anything. Scope is enforced server-side: a forged
// request body can only ever operate on `req.user.clientId`.

interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: 'client' | 'client_admin';
  isActive: boolean;
  isYou: boolean;
  createdAt: string;
}

export function PortalUsersPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', makeAdmin: false });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/portal/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<{ users: PortalUser[] }> = await res.json();
      if (data.status === 'success' && data.data) {
        setUsers(data.data.users);
      }
    } catch (err) {
      logError('fetchPortalUsers (portal) failed', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleAdd() {
    setAddError('');
    if (!addForm.name.trim() || !addForm.email.trim() || addForm.password.length < 6) {
      setAddError('Name + email + 6-character password are required.');
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/portal/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: addForm.email.trim(),
          name: addForm.name.trim(),
          password: addForm.password,
          promoteAsClientAdmin: addForm.makeAdmin,
        }),
      });
      const data: ApiResponse<{ user: PortalUser }> = await res.json();
      if (!res.ok || data.status !== 'success') {
        setAddError(data.message || 'Failed to add user');
        setAddLoading(false);
        return;
      }
      toast.success(`Portal user added — ${addForm.email}`);
      setAddOpen(false);
      setAddForm({ name: '', email: '', password: '', makeAdmin: false });
      fetchUsers();
    } catch (err) {
      logError('createPortalUser (portal) failed', err);
      setAddError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          Manage who can sign in to your portal. Anyone you add gets full access for now;
          per-tab permissions are coming. You'll need to share the password directly with
          them — emails are not sent automatically yet.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <UsersIcon className="size-4" />
                Portal logins
              </CardTitle>
              <CardDescription>
                {users.length} user{users.length !== 1 ? 's' : ''} can sign in to this portal
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="size-4 mr-1.5" />
              Add user
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="No portal users yet"
              description="Click Add user to give a teammate access to this portal."
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
                        <p className="text-sm font-medium">
                          {u.name}
                          {u.isYou && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                        </p>
                        {isAdmin ? (
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-xs">
                            <Crown className="size-3 mr-1" /> Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <UserIcon className="size-3 mr-1" /> User
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
              Creates a sign-in for this portal. Every user currently sees every tab — per-tab
              access controls are coming in a later release.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="ppu-name">Name</Label>
              <Input
                id="ppu-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Jamie Smith"
                disabled={addLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ppu-email">Email</Label>
              <Input
                id="ppu-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jamie@yourcompany.com"
                disabled={addLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ppu-password">Initial password</Label>
              <Input
                id="ppu-password"
                type="text"
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="At least 6 characters — share with them directly"
                disabled={addLoading}
              />
              <p className="text-xs text-muted-foreground">
                Outbound email is still being set up, so you'll need to share this password with
                them directly (Slack/WhatsApp/etc).
              </p>
            </div>
            <div className="flex items-start gap-3 pt-1">
              <Switch
                id="ppu-make-admin"
                checked={addForm.makeAdmin}
                onCheckedChange={(v: boolean) => setAddForm((f) => ({ ...f, makeAdmin: v }))}
                disabled={addLoading}
              />
              <Label htmlFor="ppu-make-admin" className="text-sm cursor-pointer">
                <span className="font-medium">Make admin</span>
                <span className="block text-xs text-muted-foreground font-normal">
                  Admins can add / remove portal users and upload signed agreements.
                </span>
              </Label>
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
              Add user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!loading && currentUser?.role !== 'client_admin' && (
        <p className="text-xs text-muted-foreground">
          You're signed in as a standard portal user. Ask your account admin to give you admin
          access if you need to manage other users.
        </p>
      )}
    </div>
  );
}
