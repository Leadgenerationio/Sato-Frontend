import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Briefcase, Building, CalendarDays, Shield, TreePalm, ExternalLink,
} from 'lucide-react';
import { useStaffMember, useHolidayRequests } from '@/lib/hooks/use-staff';
import { StaffDocumentsTab } from './index';

// ─── Helpers ───

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

const DETAIL_TABS = ['profile', 'tasks', 'holidays', 'documents'] as const;
type DetailTab = typeof DETAIL_TABS[number];
const detailTabLabels: Record<DetailTab, string> = {
  profile: 'Profile',
  tasks: 'Tasks',
  holidays: 'Holidays',
  documents: 'Documents',
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <Icon className="size-4" style={{ color: 'var(--fg3)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: 'var(--fg2)' }}>{label}</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Main Page ───

export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: member, isLoading, error } = useStaffMember(id!);
  const { data: allHolidays, isLoading: holidaysLoading } = useHolidayRequests();
  const [tab, setTab] = useState<DetailTab>('profile');

  const memberHolidays = allHolidays?.filter((h) => h.staffId === id) ?? [];

  if (isLoading) {
    return (
      <div className="screen-page">
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg2)' }}>Loading staff member…</div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="screen-page">
        <div className="ph-screen">
          <span className="ph-screen-ic"><User className="size-[26px]" /></span>
          <strong>Staff member not found</strong>
          <Link to="/staff"><button className="btn b-ghost b-sm"><ArrowLeft className="size-[15px]" /> Back to staff</button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/staff" className="nc-back" title="Back to staff"><ArrowLeft className="size-5" /></Link>
          <div>
            <h1 className="ahead-title">{member.name}</h1>
            <p className="ahead-sub">{member.role}</p>
          </div>
        </div>
        <div className="page-actions">
          <span className="staff-dept">{member.department}</span>
          <span className={'pill p-' + (staffStatusPill[member.status] || 'gray')}>{staffStatusLabels[member.status] || member.status}</span>
        </div>
      </div>

      <div className="seg staff-seg" style={{ alignSelf: 'flex-start' }}>
        {DETAIL_TABS.map((t) => (
          <button key={t} className={'seg-btn' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{detailTabLabels[t]}</button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="grid-2-1" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Personal Information</h3>
            <InfoRow icon={User} label="Full Name" value={member.name} />
            <InfoRow icon={Mail} label="Email" value={member.email} />
            <InfoRow icon={Briefcase} label="Role" value={member.role} />
            <InfoRow icon={Building} label="Department" value={member.department} />
          </div>
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Employment</h3>
            <InfoRow icon={CalendarDays} label="Start Date" value={formatDate(member.startDate)} />
            <InfoRow icon={Shield} label="Status" value={staffStatusLabels[member.status] || member.status} />
            <InfoRow icon={TreePalm} label="Holidays Remaining" value={`${member.holidaysRemaining} days`} />
            <InfoRow icon={TreePalm} label="Holidays Taken" value={`${member.holidaysTaken} days`} />
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <div className="card pad acard">
          <h3 className="statto-title nc-h">Tasks</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ExternalLink className="size-5" style={{ color: 'var(--fg3)' }} />
            <p style={{ fontSize: 14, color: 'var(--fg1)' }}>
              View tasks assigned to {member.name} on the{' '}
              <Link to={`/tasks?assignee=${encodeURIComponent(member.name)}`} style={{ color: 'var(--statto-ink)', textDecoration: 'underline' }}>
                Tasks page
              </Link>.
            </p>
          </div>
        </div>
      )}

      {/* Documents Tab — per-staff documents (contracts, NDAs, payslips).
          Reuses the same StaffDocumentsTab as the global Staff page so the
          FileUpload + add/remove mutation hooks stay in one place. */}
      {tab === 'documents' && <StaffDocumentsTab staffId={id!} />}

      {/* Holidays Tab */}
      {tab === 'holidays' && (
        <div className="card acard inv-card">
          {holidaysLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg2)' }}>Loading holidays…</div>
          ) : !memberHolidays.length ? (
            <div className="ph-screen">
              <span className="ph-screen-ic"><TreePalm className="size-[26px]" /></span>
              <strong>No holiday requests for this staff member</strong>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    <th>Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {memberHolidays.map((h) => (
                    <tr key={h.id}>
                      <td><span className={'pill p-' + (holidayTypePill[h.type] || 'gray')} style={{ textTransform: 'capitalize' }}>{h.type}</span></td>
                      <td className="inv-num">{formatDate(h.startDate)}</td>
                      <td className="inv-num">{formatDate(h.endDate)}</td>
                      <td><span className={'pill p-' + (holidayStatusPill[h.status] || 'gray')} style={{ textTransform: 'capitalize' }}>{h.status}</span></td>
                      <td className="inv-num">{h.approvedBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
