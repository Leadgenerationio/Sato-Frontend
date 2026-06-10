import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { StatCardSkeleton, UserTableSkeleton, PermissionMatrixSkeleton } from '@/components/shared/loading-skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import {
  Shield, Users, ChevronDown, UserCheck, UserX, Loader2, Crown,
  Calculator, Briefcase, Eye, User, AlertTriangle, Plus, Pencil,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { API_URL } from '@/lib/env';
import type { UserRole, ApiResponse } from '@/types';
import { toast } from 'sonner';

import { logError, logWarn } from '../lib/log';

interface PermissionEntry {
  permission: string;
  access: Record<UserRole, boolean>;
}

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string | null;
  clientId: string | null;
  isActive: boolean;
  isPrimaryOwner?: boolean;
  createdAt: string;
}

type ConfirmAction =
  | { type: 'role'; userId: string; userName: string; currentRole: UserRole; newRole: UserRole }
  | { type: 'toggle'; userId: string; userName: string; isActive: boolean };

const allRoles: { value: UserRole; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'owner', label: 'Owner', icon: Crown, desc: 'Full access to everything' },
  { value: 'finance_admin', label: 'Finance Admin', icon: Calculator, desc: 'Manage invoices, payments & reports' },
  { value: 'ops_manager', label: 'Ops Manager', icon: Briefcase, desc: 'Manage campaigns & lead delivery' },
  { value: 'client', label: 'Client', icon: User, desc: 'View own portal, invoices & leads' },
  { value: 'readonly', label: 'Readonly', icon: Eye, desc: 'View-only access to dashboards' },
];

function getRoleIcon(role: UserRole) { return allRoles.find((r) => r.value === role)?.icon || Shield; }
function getRoleLabel(role: UserRole) { return allRoles.find((r) => r.value === role)?.label || role; }

// Statto role picker shared by the Add + Edit dialogs.
function RolePicker({ value, onChange }: { value: UserRole; onChange: (r: UserRole) => void }) {
  return (
    <div className="set-roles">
      {allRoles.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          className={'set-role' + (value === r.value ? ' on' : '')}
        >
          <span className="set-role-ic"><r.icon className="size-[18px]" /></span>
          <div className="set-role-meta">
            <div className="set-role-name">{r.label}</div>
            <div className="set-role-desc">{r.desc}</div>
          </div>
          {value === r.value && <span className="set-role-dot" />}
        </button>
      ))}
    </div>
  );
}

export function UsersPage() {
  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">User Management</h1>
          <p className="ahead-sub">Manage users and their role permissions</p>
        </div>
      </div>
      <UsersManagement />
    </div>
  );
}

export function UsersManagement() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Add user dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'readonly' as UserRole });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Edit user dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'readonly' as UserRole });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [permConfirmOpen, setPermConfirmOpen] = useState(false);
  const [pendingPerm, setPendingPerm] = useState<{ permission: string; role: UserRole; newValue: boolean } | null>(null);
  const [permUpdating, setPermUpdating] = useState(false);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/permissions`, { headers: { Authorization: `Bearer ${token}` } });
      const data: ApiResponse<{ permissions: PermissionEntry[] }> = await res.json();
      if (data.status === 'success' && data.data) setPermissions(data.data.permissions);
    } catch (err) {
      logWarn('fetchPermissions failed', err);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data: ApiResponse<{ users: UserItem[] }> = await res.json();
      if (data.status === 'success' && data.data) setUsers(data.data.users);
    } catch (err) {
      logWarn('fetchUsers failed', err);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchUsers(); fetchPermissions(); }, [fetchUsers, fetchPermissions]);

  // ─── Add User ───
  function openAddDialog() {
    setAddForm({ name: '', email: '', password: '', role: 'readonly' });
    setAddError('');
    setAddOpen(true);
  }

  async function handleAddUser() {
    if (!addForm.name || !addForm.email || !addForm.password) {
      setAddError('All fields are required');
      return;
    }
    setAddLoading(true);
    setAddError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(addForm),
      });
      const data: ApiResponse<{ user: UserItem }> = await res.json();
      if (data.status === 'success' && data.data) {
        setUsers((prev) => [...prev, data.data!.user]);
        setAddOpen(false);
        toast.success('User created', { description: `${addForm.name} has been added as ${getRoleLabel(addForm.role)}.` });
      } else {
        setAddError(data.message || 'Failed to create user');
        toast.error('Failed to create user', { description: data.message });
      }
    } catch (err) {
      logError('Add user failed', err);
      setAddError('Network error');
      toast.error('Network error');
    } finally { setAddLoading(false); }
  }

  // ─── Edit User ───
  function openEditDialog(u: UserItem) {
    setEditUser(u);
    setEditForm({ name: u.name, role: u.role });
    setEditError('');
    setEditOpen(true);
  }

  async function handleEditUser() {
    if (!editUser || !editForm.name) { setEditError('Name is required'); return; }
    setEditLoading(true);
    setEditError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      const data: ApiResponse<{ user: UserItem }> = await res.json();
      if (data.status === 'success' && data.data) {
        setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...data.data!.user } : u)));
        setEditOpen(false);
        toast.success('User updated', { description: `${editForm.name}'s details have been saved.` });
      } else {
        setEditError(data.message || 'Failed to update user');
        toast.error('Failed to update user', { description: data.message });
      }
    } catch (err) {
      logError('Edit user failed', err);
      setEditError('Network error');
      toast.error('Network error');
    } finally { setEditLoading(false); }
  }

  // ─── Confirm role change / toggle ───
  function requestRoleChange(userId: string, userName: string, currentRole: UserRole, newRole: UserRole) {
    if (currentRole === newRole) return;
    setConfirmAction({ type: 'role', userId, userName, currentRole, newRole });
    setConfirmOpen(true);
  }

  function requestToggle(userId: string, userName: string, isActive: boolean) {
    setConfirmAction({ type: 'toggle', userId, userName, isActive });
    setConfirmOpen(true);
  }

  async function executeConfirm() {
    if (!confirmAction) return;
    const userId = confirmAction.userId;
    setConfirmOpen(false);
    setUpdating(userId);
    try {
      if (confirmAction.type === 'role') {
        const res = await fetch(`${API_URL}/api/v1/users/${userId}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ role: confirmAction.newRole }),
        });
        const data: ApiResponse<{ user: UserItem }> = await res.json();
        if (data.status === 'success' && data.data) {
          setUsers((p) => p.map((u) => (u.id === userId ? { ...u, role: data.data!.user.role } : u)));
          toast.success('Role updated', { description: `${confirmAction.userName} is now ${getRoleLabel(confirmAction.newRole)}.` });
        }
      } else {
        const res = await fetch(`${API_URL}/api/v1/users/${userId}/toggle-active`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
        });
        const data: ApiResponse<{ user: UserItem }> = await res.json();
        if (data.status === 'success' && data.data) {
          setUsers((p) => p.map((u) => (u.id === userId ? { ...u, isActive: data.data!.user.isActive } : u)));
          toast.success(confirmAction.isActive ? 'User deactivated' : 'User activated', { description: `${confirmAction.userName} has been ${confirmAction.isActive ? 'deactivated' : 'activated'}.` });
        }
      }
    } catch (err) {
      logError('Confirm action failed', err);
      toast.error('Action failed');
    } finally { setUpdating(null); setConfirmAction(null); }
  }

  // ─── Permission toggle ───
  function requestPermToggle(permission: string, role: UserRole, newValue: boolean) {
    setPendingPerm({ permission, role, newValue });
    setPermConfirmOpen(true);
  }

  async function confirmPermToggle() {
    if (!pendingPerm) return;
    setPermConfirmOpen(false);
    setPermUpdating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          permission: pendingPerm.permission,
          role: pendingPerm.role,
          allowed: pendingPerm.newValue,
        }),
      });
      const data: ApiResponse<{ permission: PermissionEntry }> = await res.json();
      if (data.status === 'success' && data.data) {
        setPermissions((prev) => prev.map((p) => (p.permission === data.data!.permission.permission ? data.data!.permission : p)));
        toast.success('Permission updated', {
          description: `"${pendingPerm.permission}" ${pendingPerm.newValue ? 'enabled' : 'disabled'} for ${getRoleLabel(pendingPerm.role)}.`,
        });
      }
    } catch (err) {
      logError('Permission update failed', err);
      toast.error('Failed to update permission');
    } finally { setPermUpdating(false); setPendingPerm(null); }
  }

  if (!user) return null;

  const stats = { total: users.length, active: users.filter((u) => u.isActive).length, owners: users.filter((u) => u.role === 'owner').length };

  return (
    <div className="screen-page">
      <div className="set-users-bar">
        <button className="btn b-dark b-sm" onClick={openAddDialog}>
          <Plus className="size-[15px]" />
          Add User
        </button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="tk-stat-row set-users-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
        </div>
      ) : (
        <div className="tk-stat-row set-users-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="tk-stat">
            <span className="tk-stat-ic plain"><Users className="size-5" /></span>
            <div><div className="tk-stat-v">{stats.total}</div><div className="tk-stat-l">Total Users</div></div>
          </div>
          <div className="tk-stat">
            <span className="tk-stat-ic pos"><UserCheck className="size-5" /></span>
            <div><div className="tk-stat-v">{stats.active}</div><div className="tk-stat-l">Active Users</div></div>
          </div>
          <div className="tk-stat">
            <span className="tk-stat-ic info"><Crown className="size-5" /></span>
            <div><div className="tk-stat-v">{stats.owners}</div><div className="tk-stat-l">Owners</div></div>
          </div>
        </div>
      )}

      {/* Role Access Matrix — editable by owner */}
      <div className="card pad acard">
        <h3 className="statto-title">Role Access Matrix</h3>
        <p className="ac-sub" style={{ marginTop: 4, marginBottom: 20 }}>Toggle switches to change what each role can access</p>
        {permissions.length === 0 ? (
          <PermissionMatrixSkeleton />
        ) : (
          <div className="table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Permission</th>
                  {allRoles.map((r) => (
                    <th key={r.value} style={{ textAlign: 'center', minWidth: 100 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <r.icon className="size-4" />
                        <span style={{ fontSize: 12 }}>{r.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((row) => (
                  <tr key={row.permission}>
                    <td style={{ fontWeight: 500 }}>{row.permission}</td>
                    {allRoles.map((r) => {
                      const allowed = row.access[r.value];
                      const isOwnerCol = r.value === 'owner';
                      return (
                        <td key={r.value} style={{ textAlign: 'center' }}>
                          {isOwnerCol ? (
                            <span className="pill p-pos">Always</span>
                          ) : (
                            <Switch
                              checked={allowed}
                              onCheckedChange={(val) => requestPermToggle(row.permission, r.value, val)}
                              disabled={permUpdating}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="card pad acard">
        <h3 className="statto-title">All Users</h3>
        <p className="ac-sub" style={{ marginTop: 4, marginBottom: 20 }}>Click role to change permissions, or edit to update details</p>
        {loading ? (
          <UserTableSkeleton rows={5} />
        ) : (
          <div className="table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const RoleIcon = getRoleIcon(u.role);
                  const isSelf = u.id === user.id;
                  const isProtected = u.isPrimaryOwner === true && !isSelf;
                  const roleLocked = isSelf || isProtected;
                  return (
                    <tr key={u.id} style={!u.isActive ? { opacity: 0.5 } : undefined}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="set-avatar" style={{ width: 38, height: 38, fontSize: 14 }}>
                            {u.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                              {u.name}
                              {isSelf && <span className="pill p-gray">You</span>}
                              {u.isPrimaryOwner && <span className="pill p-gray"><Crown className="size-[10px]" />Primary</span>}
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--fg2)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {roleLocked ? (
                          <span className="pill p-gray" style={{ textTransform: 'capitalize' }}><RoleIcon className="size-3" />{u.role.replace('_', ' ')}</span>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="btn b-ghost b-xs" disabled={updating === u.id} style={{ textTransform: 'capitalize' }}>
                                {updating === u.id ? <Loader2 className="size-3 animate-spin" /> : <RoleIcon className="size-3" />}
                                <span>{u.role.replace('_', ' ')}</span>
                                <ChevronDown className="size-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64">
                              <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {allRoles.map((r) => (
                                <DropdownMenuItem key={r.value} onClick={() => requestRoleChange(u.id, u.name, u.role, r.value)} className="flex items-start gap-3 py-2">
                                  <r.icon className="size-4 mt-0.5 shrink-0" />
                                  <div><p className="text-sm font-medium">{r.label}</p><p className="text-xs text-muted-foreground">{r.desc}</p></div>
                                  {u.role === r.value && <div className="size-2 rounded-full bg-neutral-900 ml-auto mt-1.5 shrink-0" />}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                      <td>
                        <span className={'pill ' + (u.isActive ? 'p-pos' : 'p-neg')}>{u.isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {!isSelf && !isProtected && (
                            <button className="btn b-ghost b-xs" onClick={() => openEditDialog(u)}>
                              <Pencil className="size-3" /> Edit
                            </button>
                          )}
                          {!isSelf && !isProtected && (
                            <button className="btn b-ghost b-xs" onClick={() => requestToggle(u.id, u.name, u.isActive)} disabled={updating === u.id}>
                              {updating === u.id ? <Loader2 className="size-3 animate-spin" /> : u.isActive ? <><UserX className="size-3" /> Deactivate</> : <><UserCheck className="size-3" /> Activate</>}
                            </button>
                          )}
                          {isProtected && (
                            <span className="pill p-gray"><Shield className="size-[10px]" />Protected</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Add User Dialog ─── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="size-5" /> Add New User</DialogTitle>
            <DialogDescription>Create a new user account with a specific role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {addError && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"><div className="size-1.5 rounded-full bg-red-500 shrink-0" />{addError}</div>}
            <div className="nc-field">
              <label className="nc-label">Full Name</label>
              <input className="nc-input" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div className="nc-field">
              <label className="nc-label">Email</label>
              <input className="nc-input" type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} placeholder="john@stato.app" />
            </div>
            <div className="nc-field">
              <label className="nc-label">Password</label>
              <input className="nc-input" type="password" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" />
            </div>
            <div className="nc-field">
              <label className="nc-label">Role</label>
              <RolePicker value={addForm.role} onChange={(role) => setAddForm((f) => ({ ...f, role }))} />
            </div>
          </div>
          <DialogFooter>
            <button className="btn b-ghost b-sm" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn b-dark b-sm" onClick={handleAddUser} disabled={addLoading}>
              {addLoading ? <><Loader2 className="size-4 animate-spin" /> Creating...</> : 'Create User'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit User Dialog ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="size-5" /> Edit User</DialogTitle>
            <DialogDescription>Update {editUser?.name}'s details and role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editError && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"><div className="size-1.5 rounded-full bg-red-500 shrink-0" />{editError}</div>}
            <div className="nc-field">
              <label className="nc-label">Email</label>
              <input className="nc-input" value={editUser?.email || ''} disabled />
            </div>
            <div className="nc-field">
              <label className="nc-label">Full Name</label>
              <input className="nc-input" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="nc-field">
              <label className="nc-label">Role</label>
              <RolePicker value={editForm.role} onChange={(role) => setEditForm((f) => ({ ...f, role }))} />
            </div>
          </div>
          <DialogFooter>
            <button className="btn b-ghost b-sm" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn b-dark b-sm" onClick={handleEditUser} disabled={editLoading}>
              {editLoading ? <><Loader2 className="size-4 animate-spin" /> Saving...</> : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Confirmation Dialog ─── */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open) { setConfirmOpen(false); setConfirmAction(null); } }}>
        <DialogContent>
          {confirmAction?.type === 'role' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Shield className="size-5" /> Change Role</DialogTitle>
                <DialogDescription>Are you sure you want to change this user's role?</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">User</span><span className="text-sm font-medium">{confirmAction.userName}</span></div>
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Current Role</span><span className="pill p-gray" style={{ textTransform: 'capitalize' }}>{getRoleLabel(confirmAction.currentRole)}</span></div>
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">New Role</span><span className="pill p-pos" style={{ textTransform: 'capitalize' }}>{getRoleLabel(confirmAction.newRole)}</span></div>
              </div>
              {confirmAction.newRole === 'owner' && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">Granting <strong>Owner</strong> role gives full system access including user management.</p>
                </div>
              )}
              <DialogFooter>
                <button className="btn b-ghost b-sm" onClick={() => { setConfirmOpen(false); setConfirmAction(null); }}>Cancel</button>
                <button className="btn b-dark b-sm" onClick={executeConfirm}>Confirm Change</button>
              </DialogFooter>
            </>
          )}
          {confirmAction?.type === 'toggle' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {confirmAction.isActive ? <UserX className="size-5 text-red-500" /> : <UserCheck className="size-5 text-emerald-500" />}
                  {confirmAction.isActive ? 'Deactivate User' : 'Activate User'}
                </DialogTitle>
                <DialogDescription>
                  {confirmAction.isActive ? 'This user will no longer be able to log in.' : 'This user will regain access with their current role.'}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">User</span><span className="text-sm font-medium">{confirmAction.userName}</span></div>
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Action</span><span className={'pill ' + (confirmAction.isActive ? 'p-neg' : 'p-pos')}>{confirmAction.isActive ? 'Deactivate' : 'Activate'}</span></div>
              </div>
              <DialogFooter>
                <button className="btn b-ghost b-sm" onClick={() => { setConfirmOpen(false); setConfirmAction(null); }}>Cancel</button>
                <button className={'btn b-sm ' + (confirmAction.isActive ? 'set-signout' : 'b-dark')} onClick={executeConfirm}>{confirmAction.isActive ? 'Deactivate' : 'Activate'}</button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Permission Toggle Confirmation ─── */}
      <Dialog open={permConfirmOpen} onOpenChange={(open) => { if (!open) { setPermConfirmOpen(false); setPendingPerm(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="size-5" /> Change Permission</DialogTitle>
            <DialogDescription>Are you sure you want to update this permission?</DialogDescription>
          </DialogHeader>
          {pendingPerm && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Permission</span>
                <span className="text-sm font-medium">{pendingPerm.permission}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <span className="pill p-gray" style={{ textTransform: 'capitalize' }}>{getRoleLabel(pendingPerm.role)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Access</span>
                <span className={'pill ' + (pendingPerm.newValue ? 'p-pos' : 'p-neg')}>
                  {pendingPerm.newValue ? 'Allow' : 'Deny'}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <button className="btn b-ghost b-sm" onClick={() => { setPermConfirmOpen(false); setPendingPerm(null); }}>Cancel</button>
            <button className="btn b-dark b-sm" onClick={confirmPermToggle} disabled={permUpdating}>
              {permUpdating ? <><Loader2 className="size-4 animate-spin" /> Updating...</> : 'Confirm'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
