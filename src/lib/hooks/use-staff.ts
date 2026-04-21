import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ───

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: 'Content Team' | 'Operations';
  startDate: string;
  status: 'active' | 'on_leave' | 'terminated';
  holidaysRemaining: number;
  holidaysTaken: number;
}

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  status: 'open' | 'closed';
  applicantCount: number;
  postedDate: string;
}

export interface Applicant {
  id: string;
  name: string;
  email: string;
  jobId: string;
  stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  appliedDate: string;
  score: number;
}

export interface HolidayRequest {
  id: string;
  staffId: string;
  staffName: string;
  type: 'annual' | 'sick' | 'personal';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy: string | null;
}

export interface StaffStats {
  totalStaff: number;
  activeStaff: number;
  openPositions: number;
  pendingHolidays: number;
}

// ─── Hooks ───

export function useStaffList() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await api.get<{ staff: StaffMember[] }>('/api/v1/hr/staff');
      return res.data!.staff;
    },
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<StaffMember>) => {
      const res = await api.post<{ member: StaffMember }>('/api/v1/hr/staff', data);
      return res.data!.member;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); qc.invalidateQueries({ queryKey: ['staff-stats'] }); },
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<StaffMember> & { id: string }) => {
      const res = await api.put<{ member: StaffMember }>(`/api/v1/hr/staff/${id}`, data);
      return res.data!.member;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); },
  });
}

export function useCreateJobPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; department: string }) => {
      const res = await api.post<{ job: JobPosting }>('/api/v1/hr/jobs', data);
      return res.data!.job;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['job-postings'] }); qc.invalidateQueries({ queryKey: ['staff-stats'] }); },
  });
}

export function useStaffMember(id: string) {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: async () => {
      const res = await api.get<{ member: StaffMember }>(`/api/v1/hr/staff/${id}`);
      return res.data!.member;
    },
    enabled: !!id,
  });
}

export function useStaffStats() {
  return useQuery({
    queryKey: ['staff-stats'],
    queryFn: async () => {
      const res = await api.get<{ stats: StaffStats }>('/api/v1/hr/staff/stats');
      return res.data!.stats;
    },
  });
}

export function useJobPostings() {
  return useQuery({
    queryKey: ['job-postings'],
    queryFn: async () => {
      const res = await api.get<{ jobs: JobPosting[] }>('/api/v1/hr/jobs');
      return res.data!.jobs;
    },
  });
}

export function useApplicants(jobId: string) {
  return useQuery({
    queryKey: ['applicants', jobId],
    queryFn: async () => {
      const res = await api.get<{ applicants: Applicant[] }>(`/api/v1/hr/jobs/${jobId}/applicants`);
      return res.data!.applicants;
    },
    enabled: !!jobId,
  });
}

export function useUpdateApplicantStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Applicant['stage'] }) => {
      const res = await api.patch<{ applicant: Applicant }>(`/api/v1/hr/applicants/${id}/stage`, { stage });
      return res.data!.applicant;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applicants'] });
      qc.invalidateQueries({ queryKey: ['job-postings'] });
    },
  });
}

export function useHolidayRequests() {
  return useQuery({
    queryKey: ['holiday-requests'],
    queryFn: async () => {
      const res = await api.get<{ holidays: HolidayRequest[] }>('/api/v1/hr/holidays');
      return res.data!.holidays;
    },
  });
}

export function useCreateHolidayRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { staffId: string; staffName: string; type: HolidayRequest['type']; startDate: string; endDate: string }) => {
      const res = await api.post<{ holiday: HolidayRequest }>('/api/v1/hr/holidays', data);
      return res.data!.holiday;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holiday-requests'] });
      qc.invalidateQueries({ queryKey: ['staff-stats'] });
    },
  });
}

export function useApproveHolidayRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<{ holiday: HolidayRequest }>(`/api/v1/hr/holidays/${id}/approve`);
      return res.data!.holiday;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holiday-requests'] });
      qc.invalidateQueries({ queryKey: ['staff-stats'] });
    },
  });
}

export function useRejectHolidayRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<{ holiday: HolidayRequest }>(`/api/v1/hr/holidays/${id}/reject`);
      return res.data!.holiday;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holiday-requests'] });
      qc.invalidateQueries({ queryKey: ['staff-stats'] });
    },
  });
}
