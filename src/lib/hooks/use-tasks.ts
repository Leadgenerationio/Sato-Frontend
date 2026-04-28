import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface TaskSummary {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: string;
  category: string;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface TaskAuditEntry {
  action: string;
  user: string;
  timestamp: string;
}

export interface TaskDetail extends TaskSummary {
  comments: TaskComment[];
  auditLog: TaskAuditEntry[];
}

export interface TaskStats {
  total: number;
  inProgress: number;
  completedToday: number;
  overdue: number;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
}

export interface PaginatedTasks {
  tasks: TaskSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export function useTasks(filters?: { status?: string; priority?: string; search?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.priority && filters.priority !== 'all') params.set('priority', filters.priority);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const res = await api.get<PaginatedTasks>(`/api/v1/tasks${qs ? `?${qs}` : ''}`);
      return unwrap(res);
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      const res = await api.get<{ task: TaskDetail }>(`/api/v1/tasks/${id}`);
      return unwrap(res).task;
    },
    enabled: !!id,
  });
}

export function useTaskStats() {
  return useQuery({
    queryKey: ['task-stats'],
    queryFn: async () => {
      const res = await api.get<{ stats: TaskStats }>('/api/v1/tasks/stats');
      return unwrap(res).stats;
    },
  });
}

export function useTaskTemplates() {
  return useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const res = await api.get<{ templates: TaskTemplate[] }>('/api/v1/tasks/templates');
      return unwrap(res).templates;
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; description: string; assignee: string; priority: string; category: string; dueDate: string | null }) => {
      const res = await api.post<{ task: TaskDetail }>('/api/v1/tasks', data);
      return unwrap(res).task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
    },
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch<{ task: TaskDetail }>(`/api/v1/tasks/${id}/status`, { status });
      return unwrap(res).task;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, text }: { taskId: string; text: string }) => {
      const res = await api.post<{ comment: TaskComment }>(`/api/v1/tasks/${taskId}/comments`, { text });
      return unwrap(res).comment;
    },
    onSuccess: (_, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });
}

export function useCreateFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { templateId: string; assignee: string; dueDate: string | null }) => {
      const res = await api.post<{ task: TaskDetail }>('/api/v1/tasks/from-template', data);
      return unwrap(res).task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
    },
  });
}
