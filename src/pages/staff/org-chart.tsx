import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users } from 'lucide-react';
import { useStaffList, type StaffMember } from '@/lib/hooks/use-staff';

// ─── Helpers ───

const departmentColors: Record<string, string> = {
  'Content Team': 'bg-purple-500/10 text-purple-600 border-purple-200',
  'Operations': 'bg-blue-500/10 text-blue-600 border-blue-200',
};

const statusIndicator: Record<string, string> = {
  active: 'bg-emerald-500',
  on_leave: 'bg-amber-500',
  terminated: 'bg-red-500',
};

// ─── Org Node ───

function OrgNode({ member, isHead }: { member: StaffMember; isHead?: boolean }) {
  return (
    <Link
      to={`/staff/${member.id}`}
      className={`block rounded-lg border bg-background p-4 shadow-sm hover:shadow-md transition-shadow ${
        isHead ? 'border-primary/30 ring-1 ring-primary/20' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {member.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background ${statusIndicator[member.status] || 'bg-neutral-400'}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{member.name}</p>
          <p className="text-xs text-muted-foreground truncate">{member.role}</p>
        </div>
      </div>
      <div className="mt-2">
        <Badge className={`text-xs ${departmentColors[member.department] || ''}`}>
          {member.department}
        </Badge>
      </div>
    </Link>
  );
}

// ─── Main Page ───

export function OrgChartPage() {
  const { data: staff, isLoading, error } = useStaffList();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <Users className="size-8" />
        <p>Failed to load staff</p>
        <Link to="/staff">
          <Button variant="outline">
            <ArrowLeft className="size-4 mr-2" />Back to staff
          </Button>
        </Link>
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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/staff">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
        </Link>
        <PageHeader title="Organisation Chart" description="Team structure overview" />
      </div>

      {/* Org Chart */}
      <div className="flex flex-col items-center gap-0">
        {/* Head */}
        <div className="w-64">
          <OrgNode member={head} isHead />
          <p className="text-center text-xs text-muted-foreground mt-1">Overview of All</p>
        </div>

        {/* Connector line from head */}
        <div className="w-px h-8 bg-border" />

        {/* Horizontal connector */}
        <div className="relative w-full max-w-3xl">
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-border" />
          <div className="absolute top-0 left-1/4 w-px h-8 bg-border" />
          <div className="absolute top-0 right-1/4 w-px h-8 bg-border" />
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 w-full max-w-3xl mt-8">
          {/* Content Team Column */}
          <div className="flex flex-col items-center gap-0">
            <div className="rounded-lg border-2 border-purple-200 bg-purple-500/5 px-4 py-2 mb-4">
              <p className="text-sm font-semibold text-purple-600">Content Team</p>
            </div>

            {contentManager && (
              <>
                <div className="w-full max-w-56">
                  <OrgNode member={contentManager} />
                </div>
                {contentEmployees.length > 0 && (
                  <div className="w-px h-6 bg-border" />
                )}
              </>
            )}

            <div className="space-y-3 w-full max-w-56">
              {contentEmployees.map((s) => (
                <OrgNode key={s.id} member={s} />
              ))}
            </div>

            {!contentManager && !contentEmployees.length && (
              <p className="text-sm text-muted-foreground py-4">No content team members</p>
            )}
          </div>

          {/* Operations Column */}
          <div className="flex flex-col items-center gap-0">
            <div className="rounded-lg border-2 border-blue-200 bg-blue-500/5 px-4 py-2 mb-4">
              <p className="text-sm font-semibold text-blue-600">Operations</p>
            </div>

            {opsManager && (
              <>
                <div className="w-full max-w-56">
                  <OrgNode member={opsManager} />
                </div>
                {opsEmployees.length > 0 && (
                  <div className="w-px h-6 bg-border" />
                )}
              </>
            )}

            <div className="space-y-3 w-full max-w-56">
              {opsEmployees.map((s) => (
                <OrgNode key={s.id} member={s} />
              ))}
            </div>

            {!opsManager && !opsEmployees.length && (
              <p className="text-sm text-muted-foreground py-4">No operations members</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
