import { Link } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { useStaffList, type StaffMember } from '@/lib/hooks/use-staff';

// ─── Org Node ───

function OrgNode({ member }: { member: StaffMember }) {
  return (
    <Link to={`/staff/${member.id}`} className="org-card" style={{ minWidth: 0, textDecoration: 'none' }}>
      <div className="org-card-head">
        <span className="org-avatar">
          {member.name.split(' ').map((n) => n[0]).join('')}
          <span className="org-dot" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="org-name">{member.name}</div>
          <div className="org-role">{member.role}</div>
        </div>
      </div>
      <span className="staff-dept">{member.department}</span>
    </Link>
  );
}

// ─── Main Page ───

export function OrgChartPage() {
  const { data: staff, isLoading, error } = useStaffList();

  if (isLoading) {
    return (
      <div className="screen-page">
        <div className="page-head">
          <div className="nc-title-row">
            <Link to="/staff" className="nc-back" title="Back to staff"><ArrowLeft className="size-5" /></Link>
            <div>
              <h1 className="ahead-title">Organisation Chart</h1>
              <p className="ahead-sub">Team structure overview</p>
            </div>
          </div>
        </div>
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg2)' }}>Loading org chart…</div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="screen-page">
        <div className="page-head">
          <div className="nc-title-row">
            <Link to="/staff" className="nc-back" title="Back to staff"><ArrowLeft className="size-5" /></Link>
            <div>
              <h1 className="ahead-title">Organisation Chart</h1>
              <p className="ahead-sub">Team structure overview</p>
            </div>
          </div>
        </div>
        <div className="ph-screen">
          <span className="ph-screen-ic"><Users className="size-[26px]" /></span>
          <strong>Failed to load staff</strong>
          <p>Something went wrong reaching the server. Try refreshing the page.</p>
        </div>
      </div>
    );
  }

  // Find the managing director (head of org)
  const head = staff.find((s) => s.role === 'Managing Director') || staff[0];
  const rest = staff.filter((s) => s.id !== head.id);

  // Split by department
  const contentTeam = rest.filter((s) => s.department === 'Content Team');
  const operations = rest.filter((s) => s.department === 'Operations');

  // Find managers (lead / manager roles)
  const contentManager = contentTeam.find((s) =>
    s.role.toLowerCase().includes('lead') || s.role.toLowerCase().includes('manager')
  );
  const opsManager = operations.find((s) =>
    s.role.toLowerCase().includes('lead') || s.role.toLowerCase().includes('manager')
  );

  const contentEmployees = contentTeam.filter((s) => s.id !== contentManager?.id);
  const opsEmployees = operations.filter((s) => s.id !== opsManager?.id);

  return (
    <div className="screen-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/staff" className="nc-back" title="Back to staff"><ArrowLeft className="size-5" /></Link>
          <div>
            <h1 className="ahead-title">Organisation Chart</h1>
            <p className="ahead-sub">Team structure overview</p>
          </div>
        </div>
      </div>

      <div className="org-wrap">
        <div className="org-root">
          <OrgNode member={head} />
          <div className="org-overview">Overview of All</div>
        </div>

        <div className="org-connector">
          <span className="org-line-v" />
          <span className="org-line-h" />
          <span className="org-line-down org-line-left" />
          <span className="org-line-down org-line-right" />
        </div>

        <div className="org-branches">
          <div className="org-branch">
            <span className="org-dept-pill purple">Content Team</span>
            {contentManager && <OrgNode member={contentManager} />}
            {contentEmployees.map((s) => <OrgNode key={s.id} member={s} />)}
            {!contentManager && !contentEmployees.length && (
              <span className="org-empty">No content team members</span>
            )}
          </div>
          <div className="org-branch">
            <span className="org-dept-pill blue">Operations</span>
            {opsManager && <OrgNode member={opsManager} />}
            {opsEmployees.map((s) => <OrgNode key={s.id} member={s} />)}
            {!opsManager && !opsEmployees.length && (
              <span className="org-empty">No operations members</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
