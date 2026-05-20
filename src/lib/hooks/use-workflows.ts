import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  type: string;
  schedule: string | null;
  status: string;
  /** Set on the 3 bound automations (chase-overdue, auto-invoice,
   *  monthly-validated). T4: the auto-invoice page uses this to locate
   *  its own workflow row for the pause/resume toggle. */
  handlerKey?: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  successRate: number;
}

export interface WorkflowStep {
  id: string;
  order: number;
  name: string;
  type: string;
  config: string;
  status: string;
}

export interface WorkflowExecution {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  stepsCompleted: number;
  stepsTotal: number;
  result: string | null;
}

export interface WorkflowDetail extends WorkflowSummary {
  steps: WorkflowStep[];
  recentExecutions: WorkflowExecution[];
}

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.get<{ workflows: WorkflowSummary[] }>('/api/v1/workflows');
      return unwrap(res).workflows;
    },
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const res = await api.get<{ workflow: WorkflowDetail }>(`/api/v1/workflows/${id}`);
      return unwrap(res).workflow;
    },
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description: string; type: string; schedule?: string | null; scheduleConfig?: { frequency: string; day?: string; time: string }; steps: { name: string; type: string; config: string }[] }) => {
      const res = await api.post<{ workflow: WorkflowDetail }>('/api/v1/workflows', data);
      return unwrap(res).workflow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useToggleWorkflowStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ workflow: WorkflowDetail }>(`/api/v1/workflows/${id}/toggle-status`);
      return unwrap(res).workflow;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

// T4 (Sam, 2026-05-20) — explicit pause/resume so the button is idempotent
// against rapid clicks or stale state. Toggle still works for back-compat
// with the existing /workflows page.
export function usePauseWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ workflow: WorkflowDetail }>(`/api/v1/workflows/${id}/pause`);
      return unwrap(res).workflow;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useResumeWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ workflow: WorkflowDetail }>(`/api/v1/workflows/${id}/resume`);
      return unwrap(res).workflow;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function useExecuteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ execution: WorkflowExecution }>(`/api/v1/workflows/${id}/execute`);
      return unwrap(res).execution;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['workflow', id] });
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}
