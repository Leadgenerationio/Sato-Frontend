import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Users, UserCheck, Briefcase, Calendar, ChevronDown, ChevronRight, Check, X, Plus, Loader2, Pencil, Network,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useStaffList, useStaffStats, useJobPostings, useApplicants,
  useHolidayRequests, useApproveHolidayRequest, useRejectHolidayRequest,
  useCreateStaff, useUpdateStaff, useCreateJobPosting, useCreateHolidayRequest,
  type JobPosting, type Applicant, type StaffMember,
} from '@/lib/hooks/use-staff';

// ─── Helpers ───

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const staffStatusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  on_leave: 'bg-amber-500/10 text-amber-600 border-amber-200',
  terminated: 'bg-red-500/10 text-red-600 border-red-200',
};

const staffStatusLabels: Record<string, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  terminated: 'Terminated',
};

const departmentColors: Record<string, string> = {
  'Content Team': 'bg-purple-500/10 text-purple-600 border-purple-200',
  'Operations': 'bg-blue-500/10 text-blue-600 border-blue-200',
};

const holidayTypeColors: Record<string, string> = {
  annual: 'bg-blue-500/10 text-blue-600 border-blue-200',
  sick: 'bg-red-500/10 text-red-600 border-red-200',
  personal: 'bg-amber-500/10 text-amber-600 border-amber-200',
};

const holidayStatusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-200',
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  rejected: 'bg-red-500/10 text-red-600 border-red-200',
};

const PIPELINE_STAGES: Applicant['stage'][] = ['applied', 'screening', 'interview', 'offer', 'hired'];

const stageLabels: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

// ─── Sub-components ───

function StatsCards() {
  const { data: stats, isLoading } = useStaffStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: 'Total Staff', value: stats.totalStaff, icon: Users, bg: 'bg-muted', iconColor: 'text-muted-foreground' },
    { label: 'Active Staff', value: stats.activeStaff, icon: UserCheck, bg: 'bg-emerald-500/10', iconColor: 'text-emerald-600' },
    { label: 'Open Positions', value: stats.openPositions, icon: Briefcase, bg: 'bg-blue-500/10', iconColor: 'text-blue-600' },
    { label: 'Pending Holidays', value: stats.pendingHolidays, icon: Calendar, bg: 'bg-amber-500/10', iconColor: 'text-amber-600' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`size-5 ${c.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AddStaffDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: '', department: 'Operations' as const });
  const createStaff = useCreateStaff();

  async function handleSubmit() {
    if (!form.name || !form.email) { toast.error('Name and email required'); return; }
    try {
      await createStaff.mutateAsync(form);
      toast.success(`${form.name} added`);
      setForm({ name: '', email: '', role: '', department: 'Operations' });
      setOpen(false);
    } catch { toast.error('Failed to add staff'); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1.5" />Add Staff</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@company.com" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Role</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g., Content Writer" /></div>
            <div className="space-y-1"><Label>Department</Label>
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value as any })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="Content Team">Content Team</option><option value="Operations">Operations</option>
              </select>
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={createStaff.isPending}>
            {createStaff.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}Add Staff Member
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({ member }: { member: StaffMember }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: member.name, email: member.email, role: member.role, department: member.department, status: member.status });
  const updateStaff = useUpdateStaff();

  async function handleSubmit() {
    try {
      await updateStaff.mutateAsync({ id: member.id, ...form });
      toast.success(`${form.name} updated`);
      setOpen(false);
    } catch { toast.error('Failed to update'); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="size-7"><Pencil className="size-3.5" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {member.name}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Role</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
            <div className="space-y-1"><Label>Department</Label>
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value as any })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="Content Team">Content Team</option><option value="Operations">Operations</option>
              </select>
            </div>
            <div className="space-y-1"><Label>Status</Label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="active">Active</option><option value="on_leave">On Leave</option><option value="terminated">Terminated</option>
              </select>
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={updateStaff.isPending}>
            {updateStaff.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateJobDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', department: 'Operations' });
  const createJob = useCreateJobPosting();

  async function handleSubmit() {
    if (!form.title) { toast.error('Job title required'); return; }
    try {
      await createJob.mutateAsync(form);
      toast.success(`${form.title} posted`);
      setForm({ title: '', department: 'Operations' });
      setOpen(false);
    } catch { toast.error('Failed to create job'); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1.5" />New Job</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Job Posting</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1"><Label>Job Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Senior Content Writer" /></div>
          <div className="space-y-1"><Label>Department</Label>
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="Content Team">Content Team</option><option value="Operations">Operations</option>
            </select>
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={createJob.isPending}>
            {createJob.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}Post Job
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RequestHolidayDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ staffId: '', staffName: '', type: 'annual' as const, startDate: '', endDate: '' });
  const { data: staff } = useStaffList();
  const createHoliday = useCreateHolidayRequest();

  async function handleSubmit() {
    if (!form.staffId) { toast.error('Pick a staff member'); return; }
    if (!form.startDate || !form.endDate) { toast.error('Dates required'); return; }
    try {
      await createHoliday.mutateAsync(form);
      toast.success('Holiday request submitted');
      setForm({ staffId: '', staffName: '', type: 'annual', startDate: '', endDate: '' });
      setOpen(false);
    } catch { toast.error('Failed to submit'); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1.5" />Request Holiday</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request Holiday</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1"><Label>Staff Member</Label>
            <select value={form.staffId} onChange={(e) => {
              const s = staff?.find((m) => m.id === e.target.value);
              setForm({ ...form, staffId: e.target.value, staffName: s?.name || '' });
            }} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              {staff?.filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Type</Label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="annual">Annual Leave</option><option value="sick">Sick Leave</option><option value="personal">Personal</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Start Date</Label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" /></div>
            <div className="space-y-1"><Label>End Date</Label><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" /></div>
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={createHoliday.isPending}>
            {createHoliday.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}Submit Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeamTab() {
  const { data: staff, isLoading, error } = useStaffList();

  return (
    <div className="flex flex-col gap-6">
      <StatsCards />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Users className="size-8" />
              <p className="text-sm">Failed to load staff</p>
            </div>
          ) : !staff?.length ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Users className="size-8" />
              <p className="text-sm">No staff members found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Holidays Left</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link to={`/staff/${s.id}`} className="text-primary hover:underline">
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.email}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${departmentColors[s.department] || ''}`}>
                          {s.department}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.role}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs capitalize ${staffStatusColors[s.status] || ''}`}>
                          {staffStatusLabels[s.status] || s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.holidaysRemaining}</TableCell>
                      <TableCell><EditStaffDialog member={s} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApplicantPipeline({ jobId }: { jobId: string }) {
  const { data: applicants, isLoading } = useApplicants(jobId);

  if (isLoading) {
    return <div className="p-4"><Skeleton className="h-20 w-full" /></div>;
  }

  if (!applicants?.length) {
    return <p className="p-4 text-sm text-muted-foreground">No applicants yet.</p>;
  }

  const rejected = applicants.filter((a) => a.stage === 'rejected');
  const pipeline = applicants.filter((a) => a.stage !== 'rejected');

  return (
    <div className="p-4 space-y-4">
      {/* Pipeline stages */}
      <div className="flex gap-2 overflow-x-auto">
        {PIPELINE_STAGES.map((stage) => {
          const stageApplicants = pipeline.filter((a) => a.stage === stage);
          return (
            <div key={stage} className="min-w-[150px] flex-1 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {stageLabels[stage]} ({stageApplicants.length})
              </p>
              <div className="space-y-2">
                {stageApplicants.map((a) => (
                  <div key={a.id} className="rounded-md border bg-background p-2">
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">Score: {a.score}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* Rejected */}
      {rejected.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Rejected ({rejected.length})
          </p>
          <div className="flex gap-2 flex-wrap">
            {rejected.map((a) => (
              <div key={a.id} className="rounded-md border border-red-200 bg-red-500/5 p-2">
                <p className="text-sm font-medium text-red-600">{a.name}</p>
                <p className="text-xs text-muted-foreground">Score: {a.score}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JobPostingCard({ job }: { job: JobPosting }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
            <div>
              <CardTitle className="text-base">{job.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{job.department}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">{job.applicantCount} applicants</span>
            <Badge className={`text-xs capitalize ${job.status === 'open' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-neutral-500/10 text-neutral-500 border-neutral-200'}`}>
              {job.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      {expanded && <ApplicantPipeline jobId={job.id} />}
    </Card>
  );
}

function RecruitmentTab() {
  const { data: jobs, isLoading, error } = useJobPostings();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <Briefcase className="size-8" />
        <p className="text-sm">Failed to load job postings</p>
      </div>
    );
  }

  if (!jobs?.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <Briefcase className="size-8" />
        <p className="text-sm">No job postings found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobPostingCard key={job.id} job={job} />
      ))}
    </div>
  );
}

function HolidaysTab() {
  const { data: holidays, isLoading, error } = useHolidayRequests();
  const approveMutation = useApproveHolidayRequest();
  const rejectMutation = useRejectHolidayRequest();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <Calendar className="size-8" />
        <p className="text-sm">Failed to load holiday requests</p>
      </div>
    );
  }

  if (!holidays?.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <Calendar className="size-8" />
        <p className="text-sm">No holiday requests found</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.staffName}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs capitalize ${holidayTypeColors[h.type] || ''}`}>
                      {h.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{formatDate(h.startDate)}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{formatDate(h.endDate)}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs capitalize ${holidayStatusColors[h.status] || ''}`}>
                      {h.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {h.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                          onClick={() => approveMutation.mutate(h.id)}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="size-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                          onClick={() => rejectMutation.mutate(h.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <X className="size-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───

export function StaffPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff" description="Manage your team, recruitment and holidays">
        <Link to="/staff/org-chart">
          <Button variant="outline" size="sm">
            <Network className="size-4 mr-1.5" />
            View Org Chart
          </Button>
        </Link>
      </PageHeader>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="recruitment">Recruitment</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>
        <TabsContent value="team">
          <div className="flex justify-end mb-4"><AddStaffDialog /></div>
          <TeamTab />
        </TabsContent>
        <TabsContent value="recruitment">
          <div className="flex justify-end mb-4"><CreateJobDialog /></div>
          <RecruitmentTab />
        </TabsContent>
        <TabsContent value="holidays">
          <div className="flex justify-end mb-4"><RequestHolidayDialog /></div>
          <HolidaysTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
