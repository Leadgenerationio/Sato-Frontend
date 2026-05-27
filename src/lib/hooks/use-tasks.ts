import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export interface TaskSummary {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: string;
  category: string;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  // Slice 5 Day 5 — surfaced on cards/rows so estimates are visible at a glance.
  timeBlockMinutes?: number | null;
  // Sam-Loom (jam-video #2) — surfaced so the list view can indent children
  // under their parent and the board card can show a "↪ Parent" hint.
  parentTaskId?: string | null;
  // Sam-Loom #2 follow-up — parent's title is always populated by the BE so
  // the FE can render "↪ Parent: <title>" even when the parent task is on
  // a different page of the result set (otherwise pagination silently
  // breaks the visual link).
  parentTitle?: string | null;
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

// Slice 5 Day 3 — task gained subtasks, attachments, structured activity.
export interface TaskSubtask {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  r2Key: string;
  folder: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

export interface TaskActivityEvent {
  id: string;
  taskId: string;
  actorUserId: string | null;
  actorName: string | null;
  eventType: string;
  payload: unknown;
  createdAt: string;
}

export interface TaskDetail extends TaskSummary {
  comments: TaskComment[];
  auditLog: TaskAuditEntry[];
  // Slice 5 fields — all optional because listTasks omits them to stay cheap.
  timeBlockMinutes?: number | null;
  linkedSopId?: string | null;
  parentTaskId?: string | null;
  recurrenceCron?: string | null;
  recurrenceNextRun?: string | null;
  subtasks?: TaskSubtask[];
  attachments?: TaskAttachment[];
  activity?: TaskActivityEvent[];
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

export function useTasks(filters?: { status?: string; priority?: string; search?: string; assignee?: string; archive?: 'today' | 'all' | 'archive'; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.priority && filters.priority !== 'all') params.set('priority', filters.priority);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.assignee) params.set('assignee', filters.assignee);
  // Sam-Loom #7 — pass through the archive split so the BE filters out
  // older completed tasks from the default view.
  if (filters?.archive) params.set('archive', filters.archive);
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

// Slice 5 Day 5 — create/update payload accepts the new optional fields.
// Sent only when the user explicitly fills them; backend treats missing
// keys as "no change", null as "clear".
export interface TaskMutationInput {
  title: string;
  description: string;
  assignee: string;
  priority: string;
  category: string;
  dueDate: string | null;
  timeBlockMinutes?: number | null;
  linkedSopId?: string | null;
  parentTaskId?: string | null;
  recurrenceCron?: string | null;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: TaskMutationInput) => {
      const res = await api.post<{ task: TaskDetail }>('/api/v1/tasks', data);
      return unwrap(res).task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
    },
  });
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignee?: string;
  priority?: string;
  category?: string;
  dueDate?: string | null;
  timeBlockMinutes?: number | null;
  linkedSopId?: string | null;
  parentTaskId?: string | null;
  // Slice 5 Day 7 — recurrence. null clears, a valid cron sets;
  // backend auto-computes recurrenceNextRun when omitted.
  recurrenceCron?: string | null;
}

export function useUpdateTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateTaskInput) => {
      const res = await api.put<{ task: TaskDetail }>(`/api/v1/tasks/${taskId}`, data);
      return unwrap(res).task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
      qc.invalidateQueries({ queryKey: ['task-children', taskId] });
    },
  });
}

/**
 * Hard-delete a task. Sam (2026-05-15 Loom): "there's no delete button" —
 * the row was previously editable but unremovable, so stale test tasks
 * piled up. Backend cascades subtasks / attachments / comments / activity
 * and nulls parent_task_id on children. Caller passes the id at call time
 * so a single hook covers the tasks list AND the detail page.
 */
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      await api.delete(`/api/v1/tasks/${taskId}`);
      return taskId;
    },
    onSuccess: (taskId) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task-stats'] });
      qc.removeQueries({ queryKey: ['task', taskId] });
      qc.removeQueries({ queryKey: ['task-children', taskId] });
    },
  });
}

// #91 AI new-task button — calls /tasks/ai-generate with a sentence,
// returns a structured suggestion the user reviews + edits before save.
export interface AiTaskSuggestion {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timeBlockMinutes: number | null;
  linkedSopId: string | null;
  linkedSopTitle: string | null;
  subtasks: string[];
}

export function useGenerateTaskFromPrompt() {
  return useMutation({
    mutationFn: async (prompt: string) => {
      const res = await api.post<{ suggestion: AiTaskSuggestion }>('/api/v1/tasks/ai-generate', { prompt });
      return unwrap(res).suggestion;
    },
  });
}

export function useTaskChildren(taskId: string) {
  return useQuery({
    queryKey: ['task-children', taskId],
    queryFn: async () => {
      const res = await api.get<{ children: TaskSummary[] }>(`/api/v1/tasks/${taskId}/children`);
      return unwrap(res).children;
    },
    enabled: !!taskId,
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

// ─── Slice 5 — subtasks ───
export interface CreateSubtaskInput {
  title: string;
  isDone?: boolean;
  position?: number;
}
export interface UpdateSubtaskInput {
  title?: string;
  isDone?: boolean;
  position?: number;
}

export function useCreateSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSubtaskInput) => {
      const res = await api.post<{ subtask: TaskSubtask }>(`/api/v1/tasks/${taskId}/subtasks`, input);
      return unwrap(res).subtask;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
  });
}

export function useUpdateSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subtaskId, ...input }: UpdateSubtaskInput & { subtaskId: string }) => {
      const res = await api.patch<{ subtask: TaskSubtask }>(
        `/api/v1/tasks/${taskId}/subtasks/${subtaskId}`,
        input,
      );
      return unwrap(res).subtask;
    },
    // Sam-Loom feedback (jam-video #1): the checkbox lagged because we waited
    // for the PATCH round-trip before reflecting the toggle. Flip the cached
    // subtask immediately; on error roll back to the snapshot.
    onMutate: async ({ subtaskId, ...input }) => {
      await qc.cancelQueries({ queryKey: ['task', taskId] });
      const previous = qc.getQueryData<TaskDetail>(['task', taskId]);
      if (previous?.subtasks) {
        qc.setQueryData<TaskDetail>(['task', taskId], {
          ...previous,
          subtasks: previous.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, ...input } : s,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['task', taskId], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
  });
}

export function useDeleteSubtask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subtaskId: string) => {
      await api.delete(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
  });
}

// ─── Slice 5 — attachments ───
export interface AddTaskAttachmentInput {
  r2Key: string;
  folder?: string;
  name: string;
  contentType?: string;
  sizeBytes?: number;
}

export function useAddTaskAttachment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddTaskAttachmentInput) => {
      const res = await api.post<{ attachment: TaskAttachment }>(
        `/api/v1/tasks/${taskId}/attachments`,
        input,
      );
      return unwrap(res).attachment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
  });
}

export function useRemoveTaskAttachment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      await api.delete(`/api/v1/tasks/${taskId}/attachments/${attachmentId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
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
