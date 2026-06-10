import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Users, UserCheck, Briefcase, Calendar, ChevronDown, ChevronRight, Check, X, Plus, Loader2, Pencil, Network,
  FileText, Download, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useStaffList, useStaffStats, useJobPostings, useApplicants,
  useHolidayRequests, useApproveHolidayRequest, useRejectHolidayRequest,
  useCreateStaff, useUpdateStaff, useCreateJobPosting, useCreateHolidayRequest,
  useStaffDocuments, useAddStaffDocument, useRemoveStaffDocument,
  type JobPosting, type Applicant, type StaffMember,
} from '@/lib/hooks/use-staff';
import { FileUpload } from '@/components/shared/file-upload';
import { fetchFreshDownloadUrl, type PresignedUpload } from '@/lib/hooks/use-uploads';

import { logError } from '../../lib/log';
// ─── Helpers ───

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Statto pill variant per staff status.
const staffStatusPill: Record<string, string> = {
  active: 'pos',
  on_leave: 'warn',
  terminated: 'neg',
};

const staffStatusLabels: Record<string, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  terminated: 'Terminated',
};

const holidayTypePill: Record<string, string> = {
  annual: 'infosoft',
  sick: 'neg',
  personal: 'warn',
};

const holidayStatusPill: Record<string, string> = {
  pending: 'warn',
  approved: 'pos',
  rejected: 'neg',
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

const STAFF_TABS = ['team', 'recruitment', 'holidays', 'documents'] as const;
type StaffTab = typeof STAFF_TABS[number];
const staffTabLabels: Record<StaffTab, string> = {
  team: 'Team',
  recruitment: 'Recruitment',
  holidays: 'Holidays',
  documents: 'Documents',
};

// ─── Sub-components ───

function StatsCards() {
  const { data: stats, isLoading } = useStaffStats();

  if (isLoading) {
    return (
      <div className="tk-stat-row">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="tk-stat" style={{ opacity: 0.5 }}>
            <span className="tk-stat-ic plain" />
            <div><div className="tk-stat-v">—</div><div className="tk-stat-l">Loading…</div></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: 'Total Staff', value: stats.totalStaff, icon: Users, tint: 'plain' },
    { label: 'Active Staff', value: stats.activeStaff, icon: UserCheck, tint: 'pos' },
    { label: 'Open Positions', value: stats.openPositions, icon: Briefcase, tint: 'info' },
    { label: 'Pending Holidays', value: stats.pendingHolidays, icon: Calendar, tint: 'warn' },
  ];

  return (
    <div className="tk-stat-row">
      {cards.map((c) => (
        <div key={c.label} className="tk-stat">
          <span className={`tk-stat-ic ${c.tint}`}><c.icon className="size-5" /></span>
          <div>
            <div className="tk-stat-v">{c.value}</div>
            <div className="tk-stat-l">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

type StaffDepartment = 'Content Team' | 'Operations';

function AddStaffDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string; email: string; role: string; department: StaffDepartment;
  }>({ name: '', email: '', role: '', department: 'Operations' });
  const createStaff = useCreateStaff();

  async function handleSubmit() {
    if (!form.name || !form.email) { toast.error('Name and email required'); return; }
    try {
      await createStaff.mutateAsync(form);
      toast.success(`${form.name} added`);
      setForm({ name: '', email: '', role: '', department: 'Operations' });
      setOpen(false);
    } catch (err) {
      logError('Add staff failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add staff');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><button className="btn b-dark b-sm"><Plus className="size-[15px]" /> Add Staff</button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
        <div className="nc-grid2" style={{ marginTop: 8 }}>
          <div className="nc-field"><label className="nc-label">Name</label><input className="nc-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
          <div className="nc-field"><label className="nc-label">Email</label><input className="nc-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@company.com" /></div>
          <div className="nc-field"><label className="nc-label">Role</label><input className="nc-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g., Content Writer" /></div>
          <div className="nc-field"><label className="nc-label">Department</label>
            <div className="nc-select-wrap">
              <select
                className="nc-select"
                value={form.department}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'Content Team' || v === 'Operations') setForm({ ...form, department: v });
                }}
              >
                <option value="Content Team">Content Team</option><option value="Operations">Operations</option>
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
          </div>
        </div>
        <button className="btn b-dark b-block" onClick={handleSubmit} disabled={createStaff.isPending}>
          {createStaff.isPending && <Loader2 className="size-4 animate-spin" />}Add Staff Member
        </button>
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
    } catch (err) {
      logError('Update staff failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><button className="inv-open" title="Edit"><Pencil className="size-4" /></button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {member.name}</DialogTitle></DialogHeader>
        <div className="nc-grid2" style={{ marginTop: 8 }}>
          <div className="nc-field"><label className="nc-label">Name</label><input className="nc-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="nc-field"><label className="nc-label">Email</label><input className="nc-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="nc-grid3">
          <div className="nc-field"><label className="nc-label">Role</label><input className="nc-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
          <div className="nc-field"><label className="nc-label">Department</label>
            <div className="nc-select-wrap">
              <select
                className="nc-select"
                value={form.department}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'Content Team' || v === 'Operations') setForm({ ...form, department: v });
                }}
              >
                <option value="Content Team">Content Team</option><option value="Operations">Operations</option>
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
          </div>
          <div className="nc-field"><label className="nc-label">Status</label>
            <div className="nc-select-wrap">
              <select
                className="nc-select"
                value={form.status}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'active' || v === 'on_leave' || v === 'terminated') setForm({ ...form, status: v });
                }}
              >
                <option value="active">Active</option><option value="on_leave">On Leave</option><option value="terminated">Terminated</option>
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
          </div>
        </div>
        <button className="btn b-dark b-block" onClick={handleSubmit} disabled={updateStaff.isPending}>
          {updateStaff.isPending && <Loader2 className="size-4 animate-spin" />}Save Changes
        </button>
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
    } catch (err) { logError('Operation failed', err); toast.error('Failed to create job'); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><button className="btn b-dark b-sm"><Plus className="size-[15px]" /> New Job</button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Job Posting</DialogTitle></DialogHeader>
        <div style={{ marginTop: 8 }}>
          <div className="nc-field"><label className="nc-label">Job Title</label><input className="nc-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Senior Content Writer" /></div>
          <div className="nc-field"><label className="nc-label">Department</label>
            <div className="nc-select-wrap">
              <select className="nc-select" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="Content Team">Content Team</option><option value="Operations">Operations</option>
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
          </div>
        </div>
        <button className="btn b-dark b-block" onClick={handleSubmit} disabled={createJob.isPending}>
          {createJob.isPending && <Loader2 className="size-4 animate-spin" />}Post Job
        </button>
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
    } catch (err) { logError('Operation failed', err); toast.error('Failed to submit'); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><button className="btn b-dark b-sm"><Plus className="size-[15px]" /> Request Holiday</button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request Holiday</DialogTitle></DialogHeader>
        <div style={{ marginTop: 8 }}>
          <div className="nc-field"><label className="nc-label">Staff Member</label>
            <div className="nc-select-wrap">
              <select className="nc-select" value={form.staffId} onChange={(e) => {
                const s = staff?.find((m) => m.id === e.target.value);
                setForm({ ...form, staffId: e.target.value, staffName: s?.name || '' });
              }}>
                {staff?.filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
          </div>
          <div className="nc-field"><label className="nc-label">Type</label>
            <div className="nc-select-wrap">
              <select className="nc-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
                <option value="annual">Annual Leave</option><option value="sick">Sick Leave</option><option value="personal">Personal</option>
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
          </div>
          <div className="nc-grid2">
            <div className="nc-field"><label className="nc-label">Start Date</label><input className="nc-input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="nc-field"><label className="nc-label">End Date</label><input className="nc-input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
        </div>
        <button className="btn b-dark b-block" onClick={handleSubmit} disabled={createHoliday.isPending}>
          {createHoliday.isPending && <Loader2 className="size-4 animate-spin" />}Submit Request
        </button>
      </DialogContent>
    </Dialog>
  );
}

function TeamTab() {
  const { data: staff, isLoading, error } = useStaffList();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <StatsCards />
      <div className="card acard inv-card">
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg2)' }}>Loading staff…</div>
        ) : error ? (
          <div className="ph-screen">
            <span className="ph-screen-ic"><Users className="size-[26px]" /></span>
            <strong>Failed to load staff</strong>
            <p>Something went wrong reaching the server. Try refreshing the page.</p>
          </div>
        ) : !staff?.length ? (
          <div className="ph-screen">
            <span className="ph-screen-ic"><Users className="size-[26px]" /></span>
            <strong>No staff members yet</strong>
            <p>Add your team to track roles, departments, holidays, and documents.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="inv-table staff-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="r">Holidays Left</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="staff-name"><Link to={`/staff/${s.id}`}>{s.name}</Link></td>
                    <td className="ag-email">{s.email}</td>
                    <td><span className="staff-dept">{s.department}</span></td>
                    <td className="staff-role">{s.role}</td>
                    <td><span className={'pill p-' + (staffStatusPill[s.status] || 'gray')}>{staffStatusLabels[s.status] || s.status}</span></td>
                    <td className="r staff-hol">{s.holidaysRemaining}</td>
                    <td className="r"><EditStaffDialog member={s} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicantPipeline({ jobId }: { jobId: string }) {
  const { data: applicants, isLoading } = useApplicants(jobId);

  if (isLoading) {
    return <div style={{ padding: 16, color: 'var(--fg2)' }}>Loading applicants…</div>;
  }

  if (!applicants?.length) {
    return (
      <div className="ph-screen" style={{ margin: 16 }}>
        <span className="ph-screen-ic"><Users className="size-[26px]" /></span>
        <strong>No applicants yet</strong>
        <p>When someone applies to this job posting, they'll appear here in the pipeline.</p>
      </div>
    );
  }

  const rejected = applicants.filter((a) => a.stage === 'rejected');
  const pipeline = applicants.filter((a) => a.stage !== 'rejected');

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Pipeline stages */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {PIPELINE_STAGES.map((stage) => {
          const stageApplicants = pipeline.filter((a) => a.stage === stage);
          return (
            <div key={stage} style={{ minWidth: 150, flex: 1, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--gray-50)', padding: 12 }}>
              <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                {stageLabels[stage]} ({stageApplicants.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stageApplicants.map((a) => (
                  <div key={a.id} style={{ borderRadius: 10, border: '1px solid var(--border)', background: '#fff', padding: 8 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg1)' }}>{a.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--fg2)' }}>Score: {a.score}</p>
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
          <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
            Rejected ({rejected.length})
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {rejected.map((a) => (
              <div key={a.id} style={{ borderRadius: 10, border: '1px solid var(--negative-bg)', background: 'var(--negative-bg)', padding: 8 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--negative)' }}>{a.name}</p>
                <p style={{ fontSize: 12, color: 'var(--fg2)' }}>Score: {a.score}</p>
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
    <div className="card acard">
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', padding: 20, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {expanded ? <ChevronDown className="size-4" style={{ color: 'var(--fg2)' }} /> : <ChevronRight className="size-4" style={{ color: 'var(--fg2)' }} />}
          <div>
            <h3 className="statto-title">{job.title}</h3>
            <p className="ac-sub">{job.department}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13.5, color: 'var(--fg2)' }}>{job.applicantCount} applicants</span>
          <span className={'pill p-' + (job.status === 'open' ? 'pos' : 'gray')} style={{ textTransform: 'capitalize' }}>{job.status}</span>
        </div>
      </button>
      {expanded && <ApplicantPipeline jobId={job.id} />}
    </div>
  );
}

function RecruitmentTab() {
  const { data: jobs, isLoading, error } = useJobPostings();

  if (isLoading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg2)' }}>Loading job postings…</div>;
  }

  if (error) {
    return (
      <div className="ph-screen">
        <span className="ph-screen-ic"><Briefcase className="size-[26px]" /></span>
        <strong>Couldn't load job postings</strong>
        <p>Something went wrong reaching the server. Try refreshing the page.</p>
      </div>
    );
  }

  if (!jobs?.length) {
    return (
      <div className="ph-screen">
        <span className="ph-screen-ic"><Briefcase className="size-[26px]" /></span>
        <strong>No job postings yet</strong>
        <p>Post a job to start recruiting and tracking applicants through your hiring pipeline.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
      <div className="card acard inv-card">
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg2)' }}>Loading holiday requests…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ph-screen">
        <span className="ph-screen-ic"><Calendar className="size-[26px]" /></span>
        <strong>Couldn't load holiday requests</strong>
        <p>Something went wrong reaching the server. Try refreshing the page.</p>
      </div>
    );
  }

  if (!holidays?.length) {
    return (
      <div className="ph-screen">
        <span className="ph-screen-ic"><Calendar className="size-[26px]" /></span>
        <strong>No holiday requests</strong>
        <p>When a staff member submits a holiday request, it will appear here for approval.</p>
      </div>
    );
  }

  return (
    <div className="card acard inv-card">
      <div className="table-scroll">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Type</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th className="r">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id}>
                <td className="staff-name">{h.staffName}</td>
                <td><span className={'pill p-' + (holidayTypePill[h.type] || 'gray')} style={{ textTransform: 'capitalize' }}>{h.type}</span></td>
                <td className="inv-num">{formatDate(h.startDate)}</td>
                <td className="inv-num">{formatDate(h.endDate)}</td>
                <td><span className={'pill p-' + (holidayStatusPill[h.status] || 'gray')} style={{ textTransform: 'capitalize' }}>{h.status}</span></td>
                <td className="r">
                  {h.status === 'pending' && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="btn b-ghost b-xs"
                        onClick={() => approveMutation.mutate(h.id)}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="size-[14px]" /> Approve
                      </button>
                      <button
                        className="btn b-ghost b-xs"
                        onClick={() => rejectMutation.mutate(h.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <X className="size-[14px]" /> Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ───

export function StaffPage() {
  const [tab, setTab] = useState<StaffTab>('team');

  const tabAction =
    tab === 'team' ? <AddStaffDialog /> :
    tab === 'recruitment' ? <CreateJobDialog /> :
    tab === 'holidays' ? <RequestHolidayDialog /> : null;

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Staff</h1>
          <p className="ahead-sub">Manage your team, recruitment and holidays</p>
        </div>
        <div className="page-actions">
          <Link to="/staff/org-chart">
            <button className="btn b-ghost b-sm"><Network className="size-[15px]" /> View Org Chart</button>
          </Link>
        </div>
      </div>

      <div className="staff-bar">
        <div className="seg staff-seg">
          {STAFF_TABS.map((t) => (
            <button key={t} className={'seg-btn' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{staffTabLabels[t]}</button>
          ))}
        </div>
        {tabAction}
      </div>

      {tab === 'team' && <TeamTab />}
      {tab === 'recruitment' && <RecruitmentTab />}
      {tab === 'holidays' && <HolidaysTab />}
      {tab === 'documents' && <DocumentsTab />}
    </div>
  );
}

export function StaffDocumentsTab({ staffId }: { staffId: string }) {
  const { data: documents = [], isLoading } = useStaffDocuments(staffId);
  const add = useAddStaffDocument(staffId);
  const remove = useRemoveStaffDocument(staffId);

  const handleUploaded = async (result: PresignedUpload, file: File) => {
    try {
      await add.mutateAsync({ key: result.key, name: file.name, size: result.sizeBytes, contentType: result.contentType });
      toast.success(`Uploaded ${file.name}`);
    } catch (err) { logError('Operation failed', err); toast.error('Failed to upload'); }
  };

  const handleDownload = async (key: string) => {
    try {
      const url = await fetchFreshDownloadUrl('misc', key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) { logError('Operation failed', err); toast.error('Failed to generate link'); }
  };

  const handleRemove = async (key: string) => {
    try {
      await remove.mutateAsync(key);
      toast.info('Removed');
    } catch (err) { logError('Operation failed', err); toast.error('Failed to remove'); }
  };

  return (
    <div className="card pad acard">
      <div className="ac-head">
        <div>
          <h3 className="statto-title">Staff documents</h3>
          <p className="ac-sub">Contracts, NDAs, payslips. Stored in Cloudflare R2.</p>
        </div>
        <FileUpload folder="misc" maxSizeMB={50} label="Upload document" onUploaded={handleUploaded} />
      </div>
      {isLoading ? (
        <p className="ac-sub" style={{ paddingTop: 8 }}>Loading documents…</p>
      ) : documents.length === 0 ? (
        <div className="ph-screen" style={{ padding: '40px 24px' }}>
          <span className="ph-screen-ic"><FileText className="size-[26px]" /></span>
          <strong>No documents</strong>
          <p>Upload contracts, NDAs, payslips, or certifications using the button above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documents.map((d) => (
            <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 12, border: '1px solid var(--border)', padding: 12 }}>
              <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12 }}>
                <span className="tk-stat-ic plain" style={{ width: 36, height: 36, borderRadius: 10 }}><FileText className="size-4" /></span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>{d.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--fg2)' }}>
                    {(d.size / 1024).toFixed(1)} KB · {new Date(d.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 4 }}>
                <button className="inv-open" onClick={() => handleDownload(d.key)} aria-label="Download">
                  <Download className="size-4" />
                </button>
                <button className="inv-open" onClick={() => handleRemove(d.key)} aria-label="Remove">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsTab() {
  const { data: staffList = [] } = useStaffList();
  const [selectedId, setSelectedId] = useState(staffList[0]?.id ?? '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="nc-field" style={{ maxWidth: 360, marginBottom: 0 }}>
        <label className="nc-label" htmlFor="staff-select">Staff member</label>
        <div className="nc-select-wrap">
          <select
            id="staff-select"
            className="nc-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select a staff member…</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.role}</option>
            ))}
          </select>
          <ChevronDown className="size-[15px]" />
        </div>
      </div>
      {selectedId ? (
        <StaffDocumentsTab staffId={selectedId} />
      ) : (
        <div className="ph-screen">
          <span className="ph-screen-ic"><FileText className="size-[26px]" /></span>
          <strong>No staff member selected</strong>
          <p>Pick a staff member above to manage their documents.</p>
        </div>
      )}
    </div>
  );
}
