import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/shared/empty-state';
import { UserPlus, Users as UsersIcon, Mail, Loader2, Crown, User as UserIcon, ShieldCheck, ShieldOff, Trash2, Settings2 } from 'lucide-react';
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

// Per-user tab visibility (Sam 27-May meeting). Dashboard + Account are
// always shown — these are the opt-in extras the admin toggles per user.
// Keep in sync with the BE PORTAL_TAB_SLUGS constant.
export type PortalTabSlug = 'leads' | 'invoices' | 'compliance' | 'creatives' | 'agreement';
export const PORTAL_TAB_OPTIONS: Array<{ slug: PortalTabSlug; label: string }> = [
  { slug: 'leads', label: 'Leads' },
  { slug: 'invoices', label: 'Invoices' },
  { slug: 'compliance', label: 'Compliance' },
  { slug: 'creatives', label: 'Creatives' },
  { slug: 'agreement', label: 'Agreement' },
];

interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: 'client' | 'client_admin';
  isActive: boolean;
  isYou: boolean;
  createdAt: string;
  // null = full access. non-null = the listed tabs (+ dashboard + account).
  allowedTabs: PortalTabSlug[] | null;
}

export function PortalUsersPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);

  const allTabsAllowed: Record<PortalTabSlug, boolean> = {
    leads: true, invoices: true, compliance: true, creatives: true, agreement: true,
  };
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<{
    name: string; email: string; password: string; makeAdmin: boolean;
    tabs: Record<PortalTabSlug, boolean>;
  }>({ name: '', email: '', password: '', makeAdmin: false, tabs: { ...allTabsAllowed } });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<PortalUser | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const [permsTarget, setPermsTarget] = useState<PortalUser | null>(null);
  const [permsTabs, setPermsTabs] = useState<Record<PortalTabSlug, boolean>>({ ...allTabsAllowed });
  const [permsLoading, setPermsLoading] = useState(false);

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

  function tabsRecordToArray(rec: Record<PortalTabSlug, boolean>): PortalTabSlug[] {
    return PORTAL_TAB_OPTIONS.filter((t) => rec[t.slug]).map((t) => t.slug);
  }

  async function handleAdd() {
    setAddError('');
    if (!addForm.name.trim() || !addForm.email.trim() || addForm.password.length < 6) {
      setAddError('Name + email + 6-character password are required.');
      return;
    }
    setAddLoading(true);
    try {
      // makeAdmin ignores per-tab restrictions (admins always see all).
      // For regular users we send the picked subset; if all are picked we
      // send null = "full access" (stays backward-compat in the DB).
      const picked = tabsRecordToArray(addForm.tabs);
      const allowedTabs = addForm.makeAdmin
        ? null
        : (picked.length === PORTAL_TAB_OPTIONS.length ? null : picked);
      const res = await fetch(`${API_URL}/api/v1/portal/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: addForm.email.trim(),
          name: addForm.name.trim(),
          password: addForm.password,
          promoteAsClientAdmin: addForm.makeAdmin,
          allowedTabs,
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
      setAddForm({ name: '', email: '', password: '', makeAdmin: false, tabs: { ...allTabsAllowed } });
      fetchUsers();
    } catch (err) {
      logError('createPortalUser (portal) failed', err);
      setAddError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAddLoading(false);
    }
  }

  function openPermissions(u: PortalUser) {
    setPermsTarget(u);
    // Pre-fill from current allowedTabs (null = all on).
    const initial: Record<PortalTabSlug, boolean> = { ...allTabsAllowed };
    if (u.allowedTabs !== null) {
      PORTAL_TAB_OPTIONS.forEach((t) => { initial[t.slug] = u.allowedTabs!.includes(t.slug); });
    }
    setPermsTabs(initial);
  }

  async function handleUpdatePermissions() {
    if (!permsTarget) return;
    setPermsLoading(true);
    try {
      const picked = tabsRecordToArray(permsTabs);
      // Same encoding as create: all picked = null (full access).
      const allowedTabs = picked.length === PORTAL_TAB_OPTIONS.length ? null : picked;
      const res = await fetch(`${API_URL}/api/v1/portal/users/${permsTarget.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ allowedTabs }),
      });
      const data: ApiResponse<{ user: PortalUser }> = await res.json();
      if (!res.ok || data.status !== 'success') {
        toast.error(data.message || 'Failed to update permissions');
        return;
      }
      toast.success(`Permissions updated — ${permsTarget.email}`);
      setPermsTarget(null);
      fetchUsers();
    } catch (err) {
      logError('updatePortalUserPermissions failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update permissions');
    } finally {
      setPermsLoading(false);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoveLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/portal/users/${removeTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<unknown> = await res.json();
      if (!res.ok || data.status !== 'success') {
        toast.error(data.message || 'Failed to remove user');
        return;
      }
      toast.success(`Portal user removed — ${removeTarget.email}`);
      // Optimistic: drop the row immediately so the table reflects the
      // delete on the same tick the dialog closes. fetchUsers() then
      // reconciles with the server in the background.
      setUsers((prev) => prev.filter((u) => u.id !== removeTarget.id));
      setRemoveTarget(null);
      fetchUsers();
    } catch (err) {
      logError('deletePortalUser (portal) failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to remove user');
    } finally {
      setRemoveLoading(false);
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
                const canRemove = currentUser?.role === 'client_admin' && !u.isYou;
                const canEditPerms = currentUser?.role === 'client_admin' && !isAdmin && !u.isYou;
                const tabsSummary = isAdmin
                  ? 'All tabs'
                  : u.allowedTabs === null
                    ? 'All tabs'
                    : `${u.allowedTabs.length} of ${PORTAL_TAB_OPTIONS.length} tabs`;
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
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="size-3" />
                          {u.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Settings2 className="size-3" />
                          {tabsSummary}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canEditPerms && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openPermissions(u)}
                          title="Edit permissions"
                        >
                          <Settings2 className="size-4 mr-1.5" />
                          Permissions
                        </Button>
                      )}
                      {canRemove && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRemoveTarget(u)}
                          title="Remove user"
                          aria-label={`Remove ${u.email}`}
                          className="text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
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
            <div className={`rounded-md border p-3 space-y-2 ${addForm.makeAdmin ? 'opacity-50' : ''}`}>
              <div>
                <p className="text-sm font-medium">Tabs they can see</p>
                <p className="text-xs text-muted-foreground">
                  {addForm.makeAdmin
                    ? 'Admins always see every tab — this section is ignored.'
                    : 'Dashboard and Account are always visible. Toggle the rest as needed.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {PORTAL_TAB_OPTIONS.map((tab) => (
                  <label
                    key={tab.slug}
                    htmlFor={`ppu-tab-${tab.slug}`}
                    className="flex items-center gap-2 rounded border px-2 py-1.5 text-sm cursor-pointer hover:bg-accent/40"
                  >
                    <Switch
                      id={`ppu-tab-${tab.slug}`}
                      checked={addForm.tabs[tab.slug]}
                      onCheckedChange={(v: boolean) => setAddForm((f) => ({ ...f, tabs: { ...f.tabs, [tab.slug]: v } }))}
                      disabled={addLoading || addForm.makeAdmin}
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

      <Dialog open={removeTarget !== null} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove portal user?</DialogTitle>
            <DialogDescription>
              {removeTarget?.name} ({removeTarget?.email}) will lose access to this portal
              immediately. This can't be undone — you'd need to add them again with a new
              password.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={removeLoading}>
              Cancel
            </Button>
            <Button onClick={handleRemove} disabled={removeLoading} className="bg-red-600 hover:bg-red-700 text-white">
              {removeLoading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Trash2 className="size-4 mr-1.5" />}
              Remove user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permsTarget !== null} onOpenChange={(o) => { if (!o) setPermsTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tab permissions — {permsTarget?.name}</DialogTitle>
            <DialogDescription>
              Choose which tabs {permsTarget?.email} can see in the portal. Dashboard and
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
              Tip: turning every tab on is the same as leaving permissions unrestricted.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPermsTarget(null)} disabled={permsLoading}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePermissions} disabled={permsLoading}>
              {permsLoading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Settings2 className="size-4 mr-1.5" />}
              Save permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
