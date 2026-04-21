import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, User, Mail, Briefcase, Building, CalendarDays, Shield, TreePalm, ExternalLink,
} from 'lucide-react';
import { useStaffMember, useHolidayRequests } from '@/lib/hooks/use-staff';

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

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Main Page ───

export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: member, isLoading, error } = useStaffMember(id!);
  const { data: allHolidays, isLoading: holidaysLoading } = useHolidayRequests();

  const memberHolidays = allHolidays?.filter((h) => h.staffId === id) ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>Staff member not found</p>
        <Link to="/staff">
          <Button variant="outline">
            <ArrowLeft className="size-4 mr-2" />Back to staff
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/staff">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
        </Link>
        <div className="flex-1">
          <PageHeader title={member.name} description={member.role}>
            <Badge className={`text-xs ${departmentColors[member.department] || ''}`}>
              {member.department}
            </Badge>
            <Badge className={`text-xs capitalize ${staffStatusColors[member.status] || ''}`}>
              {staffStatusLabels[member.status] || member.status}
            </Badge>
          </PageHeader>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={User} label="Full Name" value={member.name} />
                <Separator />
                <InfoRow icon={Mail} label="Email" value={member.email} />
                <Separator />
                <InfoRow icon={Briefcase} label="Role" value={member.role} />
                <Separator />
                <InfoRow icon={Building} label="Department" value={member.department} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Employment</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={CalendarDays} label="Start Date" value={formatDate(member.startDate)} />
                <Separator />
                <InfoRow icon={Shield} label="Status" value={staffStatusLabels[member.status] || member.status} />
                <Separator />
                <InfoRow icon={TreePalm} label="Holidays Remaining" value={`${member.holidaysRemaining} days`} />
                <Separator />
                <InfoRow icon={TreePalm} label="Holidays Taken" value={`${member.holidaysTaken} days`} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <ExternalLink className="size-5 text-muted-foreground" />
                <p className="text-sm">
                  View tasks assigned to {member.name} on the{' '}
                  <Link
                    to={`/tasks?assignee=${encodeURIComponent(member.name)}`}
                    className="text-primary underline"
                  >
                    Tasks page
                  </Link>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holidays Tab */}
        <TabsContent value="holidays" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {holidaysLoading ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : !memberHolidays.length ? (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <TreePalm className="size-8" />
                  <p className="text-sm">No holiday requests for this staff member</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Approved By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberHolidays.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>
                            <Badge className={`text-xs capitalize ${holidayTypeColors[h.type] || ''}`}>
                              {h.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {formatDate(h.startDate)}
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {formatDate(h.endDate)}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs capitalize ${holidayStatusColors[h.status] || ''}`}>
                              {h.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {h.approvedBy || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
