import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { UserPlus, Users, Mail, Loader2, ShieldCheck, ShieldOff, Crown, User as UserIcon, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/auth-provider';
import { API_URL } from '@/lib/env';
import type { ApiResponse, UserRole, PortalTabSlug } from '@/types';
import { logError } from '../../lib/log';

// Sam (2026-05-28 follow-up to jam-video #2): "when creating user Sam
// don't have the option to choose which page is visible to the user.
// Earlier it was there, when the user creation was in the client portal."
// Per-portal-user tab toggles surfaced here — Sam picks visible tabs at
// create AND can edit them later via the Permissions button on each row.
// Dashboard + Account are always visible; the optional ones the admin
// toggles per user are the five below.
const PORTAL_TAB_OPTIONS: Array<{ slug: PortalTabSlug; label: string }> = [
  { slug: 'leads', label: 'Leads' },
  { slug: 'invoices', label: 'Invoices' },
  { slug: 'compliance', label: 'Compliance' },
  { slug: 'creatives', label: 'Creatives' },
  { slug: 'agreement', label: 'Agreement' },
];

type TabToggles = Record<PortalTabSlug, boolean>;
const ALL_TABS_ON: TabToggles = {
  leads: true, invoices: true, compliance: true, creatives: true, agreement: true,
};

function tabsArrayToToggles(arr: PortalTabSlug[] | null | undefined): TabToggles {
  // null = full access → all toggles ON.
  if (!arr) return { ...ALL_TABS_ON };
  const out: TabToggles = { leads: false, invoices: false, compliance: false, creatives: false, agreement: false };
  for (const slug of arr) {
    if (slug in out) out[slug] = true;
  }
  return out;
}

function togglesToArray(t: TabToggles): PortalTabSlug[] | null {
  const picked = PORTAL_TAB_OPTIONS.filter((opt) => t[opt.slug]).map((opt) => opt.slug);
  // All-on = null = full access (backward-compat with existing rows).
  return picked.length === PORTAL_TAB_OPTIONS.length ? null : picked;
}

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
  // null = full access; non-null = only these tabs (+ Dashboard + Account).
  // Always null for client_admin (admins see every tab).
  allowedTabs: PortalTabSlug[] | null;
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
  const [addForm, setAddForm] = useState<{
    name: string; email: string; password: string;
    tabs: TabToggles;
  }>({ name: '', email: '', password: '', tabs: { ...ALL_TABS_ON } });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Sam 2026-05-28 follow-up — edit per-tab visibility on existing users.
  // Disabled for client_admin (admins always see every tab) — UI nudges to
  // demote first via the Make-admin/Demote toggle.
  const [permsTarget, setPermsTarget] = useState<PortalUser | null>(null);
  const [permsTabs, setPermsTabs] = useState<TabToggles>({ ...ALL_TABS_ON });
  const [permsLoading, setPermsLoading] = useState(false);

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

  // Sam (2026-06-17): permanently remove a portal user. Confirm first — it's a
  // hard delete of the login (their creative sign-off records are kept but
  // anonymised server-side; see migration 0038).
  const [removeTarget, setRemoveTarget] = useState<PortalUser | null>(null);
  const [removing, setRemoving] = useState(false);
  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/users/${removeTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<unknown> = await res.json();
      if (!res.ok || data.status !== 'success') {
        toast.error(data.message || 'Failed to remove portal user');
        return;
      }
      toast.success(`${removeTarget.name} removed — their portal login is deleted`);
      // Optimistic: drop the row immediately, then reconcile with the server.
      setUsers((prev) => prev.filter((u) => u.id !== removeTarget.id));
      setRemoveTarget(null);
      fetchUsers();
    } catch (err) {
      logError('removePortalUser failed', err);
      toast.error('Failed to remove portal user');
    } finally {
      setRemoving(false);
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
          allowedTabs: togglesToArray(addForm.tabs),
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
      setAddForm({ name: '', email: '', password: '', tabs: { ...ALL_TABS_ON } });
      fetchUsers();
    } catch (err) {
      logError('createPortalUser failed', err);
      setAddError(err instanceof Error ? err.message : 'Failed to create portal user');
    } finally {
      setAddLoading(false);
    }
  }

  function openPermissions(u: PortalUser) {
    setPermsTarget(u);
    setPermsTabs(tabsArrayToToggles(u.allowedTabs));
  }

  async function handleSavePermissions() {
    if (!permsTarget) return;
    setPermsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/users/${permsTarget.id}/allowed-tabs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ allowedTabs: togglesToArray(permsTabs) }),
      });
      const data: ApiResponse<unknown> = await res.json();
      if (!res.ok || data.status !== 'success') {
        toast.error(data.message || 'Failed to update permissions');
        return;
      }
      toast.success(`Permissions updated — ${permsTarget.email}`);
      setPermsTarget(null);
      fetchUsers();
    } catch (err) {
      logError('updateAllowedTabs failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update permissions');
    } finally {
      setPermsLoading(false);
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
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" />
                        {u.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Settings2 className="size-3" />
                        {isAdmin
                          ? 'All tabs (admin)'
                          : u.allowedTabs === null
                            ? 'All tabs'
                            : `${u.allowedTabs.length} of ${PORTAL_TAB_OPTIONS.length} tabs`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Sam 2026-05-28 follow-up: edit per-tab visibility.
                        Hidden for client_admin — admins always see all. */}
                    {!isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPermissions(u)}
                        title="Edit which tabs this user can see"
                      >
                        <Settings2 className="size-3.5 mr-1.5" />
                        Permissions
                      </Button>
                    )}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setRemoveTarget(u)}
                      title="Permanently remove this portal user"
                    >
                      <Trash2 className="size-3.5 mr-1.5" />
                      Remove
                    </Button>
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
            <div className="rounded-md border p-3 space-y-2">
              <div>
                <p className="text-sm font-medium">Tabs they can see</p>
                <p className="text-xs text-muted-foreground">
                  Dashboard and Account are always visible. Toggle the rest per user.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {PORTAL_TAB_OPTIONS.map((tab) => (
                  <label
                    key={tab.slug}
                    htmlFor={`pu-tab-${tab.slug}`}
                    className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm cursor-pointer hover:bg-accent/40"
                  >
                    <Switch
                      id={`pu-tab-${tab.slug}`}
                      checked={addForm.tabs[tab.slug]}
                      onCheckedChange={(v: boolean) => setAddForm((f) => ({ ...f, tabs: { ...f.tabs, [tab.slug]: v } }))}
                      disabled={addLoading}
                    />
                    {tab.label}
                  </label>
                ))}
              </div>
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

      <Dialog open={permsTarget !== null} onOpenChange={(o) => { if (!o) setPermsTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tab permissions — {permsTarget?.name}</DialogTitle>
            <DialogDescription>
              Choose which tabs {permsTarget?.email} can see in their portal. Dashboard and
              Account are always visible. Changes apply on their next page load.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <div className="grid grid-cols-2 gap-2">
              {PORTAL_TAB_OPTIONS.map((tab) => (
                <label
                  key={tab.slug}
                  htmlFor={`pup-tab-${tab.slug}`}
                  className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm cursor-pointer hover:bg-accent/40"
                >
                  <Switch
                    id={`pup-tab-${tab.slug}`}
                    checked={permsTabs[tab.slug]}
                    onCheckedChange={(v: boolean) => setPermsTabs((t) => ({ ...t, [tab.slug]: v }))}
                    disabled={permsLoading}
                  />
                  {tab.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              All toggles on = full access (same as leaving permissions unrestricted).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPermsTarget(null)} disabled={permsLoading}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={permsLoading}>
              {permsLoading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Settings2 className="size-4 mr-1.5" />}
              Save permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeTarget !== null} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove portal user?</DialogTitle>
            <DialogDescription>
              This permanently deletes <span className="font-medium">{removeTarget?.name}</span>'s
              login (<code>{removeTarget?.email}</code>) — they'll lose access to{' '}
              <span className="font-medium">{clientName}</span>'s portal immediately. Their past
              creative sign-offs are kept on record but no longer attributed to them. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Trash2 className="size-4 mr-1.5" />}
              Remove user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
