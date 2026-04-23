import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/layouts/page-header';
import { StatCardSkeleton, UserTableSkeleton, PermissionMatrixSkeleton } from '@/components/shared/loading-skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import {
  Shield, Users, ChevronDown, UserCheck, UserX, Loader2, Crown,
  Calculator, Briefcase, Eye, User, AlertTriangle, Plus, Pencil,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { UserRole, ApiResponse } from '@/types';
import { toast } from 'sonner';

interface PermissionEntry {
  permission: string;
  access: Record<UserRole, boolean>;
}

const API_URL = 'http://localhost:3001';

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

export function UsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="User Management" description="Manage users and their role permissions" />
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
    } catch { /* ignore */ }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data: ApiResponse<{ users: UserItem[] }> = await res.json();
      if (data.status === 'success' && data.data) setUsers(data.data.users);
    } catch { /* ignore */ } finally { setLoading(false); }
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
    } catch { setAddError('Network error'); toast.error('Network error'); } finally { setAddLoading(false); }
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
    } catch { setEditError('Network error'); toast.error('Network error'); } finally { setEditLoading(false); }
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
    } catch { toast.error('Action failed'); } finally { setUpdating(null); setConfirmAction(null); }
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
        body: JSON.stringify(pendingPerm),
      });
      const data: ApiResponse<{ permission: PermissionEntry }> = await res.json();
      if (data.status === 'success' && data.data) {
        setPermissions((prev) => prev.map((p) => (p.permission === data.data!.permission.permission ? data.data!.permission : p)));
        toast.success('Permission updated', {
          description: `"${pendingPerm.permission}" ${pendingPerm.newValue ? 'enabled' : 'disabled'} for ${getRoleLabel(pendingPerm.role)}.`,
        });
      }
    } catch { toast.error('Failed to update permission'); } finally { setPermUpdating(false); setPendingPerm(null); }
  }

  if (!user) return null;

  const stats = { total: users.length, active: users.filter((u) => u.isActive).length, owners: users.filter((u) => u.role === 'owner').length };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="size-4" />
          Add User
        </Button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-neutral-100"><Users className="size-5 text-neutral-700" /></div><div><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-muted-foreground">Total Users</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50"><UserCheck className="size-5 text-emerald-600" /></div><div><p className="text-2xl font-bold">{stats.active}</p><p className="text-sm text-muted-foreground">Active Users</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-amber-50"><Crown className="size-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{stats.owners}</p><p className="text-sm text-muted-foreground">Owners</p></div></div></CardContent></Card>
        </div>
      )}

      {/* Role Access Matrix — editable by owner */}
      <Card>
        <CardHeader>
          <CardTitle>Role Access Matrix</CardTitle>
          <CardDescription>Toggle switches to change what each role can access</CardDescription>
        </CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <PermissionMatrixSkeleton />
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Permission</TableHead>
                  {allRoles.map((r) => (
                    <TableHead key={r.value} className="text-center min-w-[100px]">
                      <div className="flex flex-col items-center gap-1">
                        <r.icon className="size-4" />
                        <span className="text-xs">{r.label}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((row) => (
                  <TableRow key={row.permission}>
                    <TableCell className="font-medium text-sm">{row.permission}</TableCell>
                    {allRoles.map((r) => {
                      const allowed = row.access[r.value];
                      const isOwnerCol = r.value === 'owner';
                      return (
                        <TableCell key={r.value} className="text-center">
                          {isOwnerCol ? (
                            <Badge variant="default" className="text-[10px] px-1.5">Always</Badge>
                          ) : (
                            <Switch
                              checked={allowed}
                              onCheckedChange={(val) => requestPermToggle(row.permission, r.value, val)}
                              disabled={permUpdating}
                            />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader><CardTitle>All Users</CardTitle><CardDescription>Click role to change permissions, or edit to update details</CardDescription></CardHeader>
        <CardContent>
          {loading ? (
            <UserTableSkeleton rows={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const RoleIcon = getRoleIcon(u.role);
                  const isSelf = u.id === user.id;
                  const isProtected = u.isPrimaryOwner === true && !isSelf;
                  const roleLocked = isSelf || isProtected;
                  return (
                    <TableRow key={u.id} className={!u.isActive ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar><AvatarFallback>{u.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}</AvatarFallback></Avatar>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {u.name}
                              {isSelf && <Badge variant="outline" className="text-[10px] px-1.5">You</Badge>}
                              {u.isPrimaryOwner && <Badge variant="secondary" className="text-[10px] px-1.5 gap-1"><Crown className="size-2.5" />Primary</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {roleLocked ? (
                          <Badge className="capitalize gap-1"><RoleIcon className="size-3" />{u.role.replace('_', ' ')}</Badge>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2" disabled={updating === u.id}>
                                {updating === u.id ? <Loader2 className="size-3 animate-spin" /> : <RoleIcon className="size-3" />}
                                <span className="capitalize">{u.role.replace('_', ' ')}</span>
                                <ChevronDown className="size-3" />
                              </Button>
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
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.isActive ? 'default' : 'destructive'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isSelf && !isProtected && (
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(u)} className="gap-1.5">
                              <Pencil className="size-3" /> Edit
                            </Button>
                          )}
                          {!isSelf && !isProtected && (
                            <Button variant="ghost" size="sm" onClick={() => requestToggle(u.id, u.name, u.isActive)} disabled={updating === u.id} className="gap-1.5">
                              {updating === u.id ? <Loader2 className="size-3 animate-spin" /> : u.isActive ? <><UserX className="size-3" /> Deactivate</> : <><UserCheck className="size-3" /> Activate</>}
                            </Button>
                          )}
                          {isProtected && (
                            <Badge variant="outline" className="text-[10px] gap-1"><Shield className="size-2.5" />Protected</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Add User Dialog ─── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="size-5" /> Add New User</DialogTitle>
            <DialogDescription>Create a new user account with a specific role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {addError && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"><div className="size-1.5 rounded-full bg-red-500 shrink-0" />{addError}</div>}
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} placeholder="john@stato.app" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="grid grid-cols-1 gap-2">
                {allRoles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, role: r.value }))}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${addForm.role === r.value ? 'border-neutral-900 bg-neutral-50' : 'hover:bg-neutral-50'}`}
                  >
                    <r.icon className="size-4 shrink-0" />
                    <div className="flex-1"><p className="text-sm font-medium">{r.label}</p><p className="text-xs text-muted-foreground">{r.desc}</p></div>
                    {addForm.role === r.value && <div className="size-2 rounded-full bg-neutral-900 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={addLoading}>
              {addLoading ? <><Loader2 className="size-4 animate-spin" /> Creating...</> : 'Create User'}
            </Button>
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
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editUser?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="grid grid-cols-1 gap-2">
                {allRoles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, role: r.value }))}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${editForm.role === r.value ? 'border-neutral-900 bg-neutral-50' : 'hover:bg-neutral-50'}`}
                  >
                    <r.icon className="size-4 shrink-0" />
                    <div className="flex-1"><p className="text-sm font-medium">{r.label}</p><p className="text-xs text-muted-foreground">{r.desc}</p></div>
                    {editForm.role === r.value && <div className="size-2 rounded-full bg-neutral-900 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={editLoading}>
              {editLoading ? <><Loader2 className="size-4 animate-spin" /> Saving...</> : 'Save Changes'}
            </Button>
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
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Current Role</span><Badge variant="outline" className="capitalize">{getRoleLabel(confirmAction.currentRole)}</Badge></div>
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">New Role</span><Badge className="capitalize">{getRoleLabel(confirmAction.newRole)}</Badge></div>
              </div>
              {confirmAction.newRole === 'owner' && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">Granting <strong>Owner</strong> role gives full system access including user management.</p>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmAction(null); }}>Cancel</Button>
                <Button onClick={executeConfirm}>Confirm Change</Button>
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
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Action</span><Badge variant={confirmAction.isActive ? 'destructive' : 'default'}>{confirmAction.isActive ? 'Deactivate' : 'Activate'}</Badge></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmAction(null); }}>Cancel</Button>
                <Button variant={confirmAction.isActive ? 'destructive' : 'default'} onClick={executeConfirm}>{confirmAction.isActive ? 'Deactivate' : 'Activate'}</Button>
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
                <Badge variant="secondary" className="capitalize">{getRoleLabel(pendingPerm.role)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Access</span>
                <Badge variant={pendingPerm.newValue ? 'default' : 'destructive'}>
                  {pendingPerm.newValue ? 'Allow' : 'Deny'}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPermConfirmOpen(false); setPendingPerm(null); }}>Cancel</Button>
            <Button onClick={confirmPermToggle} disabled={permUpdating}>
              {permUpdating ? <><Loader2 className="size-4 animate-spin" /> Updating...</> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
