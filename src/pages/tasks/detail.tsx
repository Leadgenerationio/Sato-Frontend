import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft, Send, Loader2, Plus, Trash2, CheckSquare, Square, Paperclip,
  Download, Activity as ActivityIcon, Repeat, Clock, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useTask, useUpdateTaskStatus, useAddComment, useUpdateTask, useDeleteTask, useTaskChildren, useTasks,
  useCreateSubtask, useUpdateSubtask, useDeleteSubtask,
  useAddTaskAttachment, useRemoveTaskAttachment,
  type TaskComment, type TaskSubtask, type TaskAttachment, type TaskActivityEvent,
  type TaskDetail, type TaskSummary,
} from '@/lib/hooks/use-tasks';
import { useSops } from '@/lib/hooks/use-sops';
import { useAuth } from '@/components/providers/auth-provider';
import { FileUpload } from '@/components/shared/file-upload';
import { fetchFreshDownloadUrl, type PresignedUpload, type UploadFolder } from '@/lib/hooks/use-uploads';

import { logError } from '../../lib/log';
const TIME_BLOCKS: { label: string; minutes: number | null }[] = [
  { label: 'No estimate', minutes: null },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: 'Half day', minutes: 240 },
  { label: 'Full day', minutes: 480 },
];

// Slice 5 Day 7 — recurrence presets. 99% of recurring tasks fall into
// one of these. "Custom" reveals a free-form cron input for the rare case.
// Backend validates the syntax server-side; we only do a cheap 5-field
// check here so the Save button can disable on obvious typos.
const RECURRENCE_PRESETS: { id: string; cron: string | null; label: string }[] = [
  { id: 'none',     cron: null,           label: 'No repeat' },
  { id: 'daily',    cron: '0 9 * * *',    label: 'Daily at 09:00' },
  { id: 'weekday',  cron: '0 9 * * 1-5',  label: 'Weekdays at 09:00' },
  { id: 'weekly',   cron: '0 9 * * 1',    label: 'Every Monday at 09:00' },
  { id: 'monthly',  cron: '0 9 1 * *',    label: '1st of every month at 09:00' },
  { id: 'custom',   cron: '',             label: 'Custom…' },
];

// Quick check: 5 non-empty fields separated by whitespace. Backend does
// the real parse — this is just to gate the Save button on obvious typos.
function looksLikeCron(s: string): boolean {
  return s.trim().split(/\s+/).filter(Boolean).length === 5;
}

// Match an existing cron string against the presets so the picker shows
// the right preset selected when opening edit on an already-recurring task.
function cronToPresetId(cron: string | null | undefined): string {
  if (!cron) return 'none';
  const hit = RECURRENCE_PRESETS.find((p) => p.cron === cron);
  return hit?.id ?? 'custom';
}

function describeRecurrence(cron: string | null | undefined): string {
  if (!cron) return 'No repeat';
  const hit = RECURRENCE_PRESETS.find((p) => p.cron === cron);
  return hit?.label ?? cron;
}

const statusColors: Record<string, string> = {
  todo: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
  in_progress: 'bg-blue-500/10 text-blue-600 border-blue-200',
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  blocked: 'bg-red-500/10 text-red-600 border-red-200',
};

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-600 border-red-200',
  high: 'bg-amber-500/10 text-amber-600 border-amber-200',
  medium: 'bg-blue-500/10 text-blue-600 border-blue-200',
  low: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

const STATUS_TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  todo: [
    { label: 'Start', next: 'in_progress' },
    { label: 'Hold', next: 'on_hold' },
  ],
  in_progress: [
    { label: 'Complete', next: 'completed' },
    { label: 'Hold', next: 'on_hold' },
  ],
  on_hold: [
    { label: 'Resume', next: 'in_progress' },
  ],
  completed: [
    { label: 'Reopen', next: 'todo' },
  ],
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Slice 5 Day 3 — activity-feed event labels. Falls back to the raw event
// type if the vocabulary grows beyond what's listed here.
function describeActivity(ev: TaskActivityEvent): string {
  const actor = ev.actorName || 'Someone';
  const p = ev.payload as Record<string, unknown> | null;
  switch (ev.eventType) {
    case 'task_created':       return `${actor} created the task`;
    case 'task_updated':       return `${actor} updated the task`;
    case 'status_changed':     return `${actor} moved status ${p?.from ?? '?'} → ${p?.to ?? '?'}`;
    case 'assignee_changed':   return `${actor} changed the assignee`;
    case 'comment_added':      return `${actor} commented`;
    case 'subtask_added':      return `${actor} added subtask "${p?.title ?? ''}"`;
    case 'subtask_completed':  return `${actor} completed "${p?.title ?? ''}"`;
    case 'subtask_uncompleted':return `${actor} reopened "${p?.title ?? ''}"`;
    case 'subtask_removed':    return `${actor} removed subtask "${p?.title ?? ''}"`;
    case 'attachment_added':   return `${actor} attached "${p?.name ?? ''}"`;
    case 'attachment_removed': return `${actor} removed "${p?.name ?? ''}"`;
    case 'recurrence_set':     return `${actor} set recurrence "${p?.cron ?? ''}"`;
    default:                   return `${actor} · ${ev.eventType}`;
  }
}

export function TaskDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: task, isLoading, error } = useTask(id!);
  const updateStatus = useUpdateTaskStatus();
  const addComment = useAddComment();
  const deleteTask = useDeleteTask();
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  // Confirm-before-delete: replaces the old window.confirm so the prompt
  // sits inside the page surface (testable, keyboard-friendly) rather than
  // a native browser dialog that vitest can't drive.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function handleConfirmDelete() {
    if (!task) return;
    try {
      await deleteTask.mutateAsync(task.id);
      toast.success(`Deleted "${task.title}"`);
      setConfirmDeleteOpen(false);
      navigate('/tasks');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleStatusChange(nextStatus: string) {
    try {
      await updateStatus.mutateAsync({ id: id!, status: nextStatus });
      toast.success(`Task moved to ${statusLabels[nextStatus] || nextStatus}`);
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to update task status');
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await addComment.mutateAsync({ taskId: id!, text: commentText });
      setCommentText('');
      toast.success('Comment added');
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to add comment');
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
        <p>Task not found</p>
        <Link to="/tasks">
          <Button variant="outline">
            <ArrowLeft className="size-4 mr-2" />Back to tasks
          </Button>
        </Link>
      </div>
    );
  }

  const transitions = STATUS_TRANSITIONS[task.status] || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/tasks">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
        </Link>
        <div className="flex-1">
          <PageHeader title={task.title}>
            <Badge className={`capitalize ${priorityColors[task.priority] || ''}`}>
              {task.priority}
            </Badge>
            <Badge className={`capitalize ${statusColors[task.status] || ''}`}>
              {statusLabels[task.status] || task.status}
            </Badge>
            {/* Sam-Loom (jam-video #10) — only the task creator sees Delete;
                the backend 403s anyone else and the icon would be a dead-end. */}
            {task.createdBy === user?.email && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleteTask.isPending}
                className="ml-auto"
              >
                <Trash2 className="size-4 mr-1.5" />
                Delete
              </Button>
            )}
          </PageHeader>
        </div>
      </div>

      {/* Confirm-before-delete dialog (replaces window.confirm). Matches the
          buyer-unlink pattern in campaigns/detail.tsx LinkedClientsCard so the
          confirm UX is consistent across the app. */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              Permanently delete <span className="font-medium">{task.title}</span>?
              This also removes its subtasks, attachments, comments, and activity log.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)} disabled={deleteTask.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Trash2 className="size-4 mr-1.5" />}
              Delete task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {task.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Relationships (Sam #94 time-block, #97 SOP, #95 parent) */}
          <RelationshipsCard task={task} />

          {/* Children (Sam #95 — child tasks of this parent) */}
          <ChildrenCard taskId={id!} />

          {/* Subtasks (Sam #90) */}
          <SubtasksCard taskId={id!} subtasks={task.subtasks ?? []} />

          {/* Attachments (Sam #87, #98) */}
          <AttachmentsCard taskId={id!} attachments={task.attachments ?? []} />

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comments ({task.comments?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.comments?.length ? (
                <div className="space-y-4">
                  {task.comments.map((comment: TaskComment) => (
                    <div key={comment.id} className="flex gap-3 rounded-lg border p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                        {comment.author.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{comment.author}</span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No comments yet</p>
              )}

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  className="flex flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button type="submit" size="icon" disabled={addComment.isPending || !commentText.trim()}>
                  {addComment.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Assignee</span>
                <span className="font-medium">{task.assignee}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Category</span>
                <Badge variant="secondary" className="text-xs">{task.category}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium tabular-nums">{formatDate(task.dueDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created By</span>
                <span className="font-medium">{task.createdBy}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created At</span>
                <span className="font-medium tabular-nums">{formatDateTime(task.createdAt)}</span>
              </div>
              {task.timeBlockMinutes != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" />Time block
                  </span>
                  <span className="font-medium">
                    {task.timeBlockMinutes < 60
                      ? `${task.timeBlockMinutes} min`
                      : `${(task.timeBlockMinutes / 60).toFixed(task.timeBlockMinutes % 60 === 0 ? 0 : 1)} hr`}
                  </span>
                </div>
              )}
              {task.recurrenceCron && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <Repeat className="size-3.5" />Recurrence
                  </span>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{task.recurrenceCron}</code>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity feed (Sam #88) */}
          <ActivityCard activity={task.activity ?? []} />

          {/* Status Actions */}
          {transitions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {transitions.map((t) => (
                  <Button
                    key={t.next}
                    variant={t.next === 'completed' ? 'default' : 'outline'}
                    className="w-full"
                    disabled={updateStatus.isPending}
                    onClick={() => handleStatusChange(t.next)}
                  >
                    {updateStatus.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                    {t.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Subtasks card (Sam #90) ────────────────────────────────────────────────
function SubtasksCard({ taskId, subtasks }: { taskId: string; subtasks: TaskSubtask[] }) {
  const create = useCreateSubtask(taskId);
  const update = useUpdateSubtask(taskId);
  const remove = useDeleteSubtask(taskId);
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    try {
      await create.mutateAsync({ title });
      setNewTitle('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add subtask');
    }
  };

  const toggleDone = async (s: TaskSubtask) => {
    try {
      await update.mutateAsync({ subtaskId: s.id, isDone: !s.isDone });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update subtask');
    }
  };

  const handleRemove = async (s: TaskSubtask) => {
    try {
      await remove.mutateAsync(s.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  const done = subtasks.filter((s) => s.isDone).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subtasks {subtasks.length > 0 && (
          <span className="text-sm text-muted-foreground font-normal ml-1">
            {done}/{subtasks.length} done
          </span>
        )}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {subtasks.length === 0 && (
          <p className="text-sm text-muted-foreground">No subtasks yet — add one below.</p>
        )}
        {subtasks.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <button
              type="button"
              onClick={() => toggleDone(s)}
              aria-label={s.isDone ? 'Mark as not done' : 'Mark as done'}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              {s.isDone ? <CheckSquare className="size-5 text-emerald-600" /> : <Square className="size-5" />}
            </button>
            <span className={`flex-1 text-sm ${s.isDone ? 'line-through text-muted-foreground' : ''}`}>
              {s.title}
            </span>
            <Button variant="ghost" size="icon" onClick={() => handleRemove(s)} aria-label="Remove">
              <Trash2 className="size-4 text-red-600" />
            </Button>
          </div>
        ))}
        <form onSubmit={handleAdd} className="flex gap-2 pt-2 border-t">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a subtask…"
          />
          <Button type="submit" size="icon" disabled={create.isPending || !newTitle.trim()} aria-label="Add subtask">
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Attachments card (Sam #87, #98) ────────────────────────────────────────
function AttachmentsCard({ taskId, attachments }: { taskId: string; attachments: TaskAttachment[] }) {
  const add = useAddTaskAttachment(taskId);
  const remove = useRemoveTaskAttachment(taskId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleUploaded = async (result: PresignedUpload, file: File) => {
    try {
      await add.mutateAsync({
        r2Key: result.key,
        folder: result.folder,
        name: file.name,
        contentType: result.contentType,
        sizeBytes: result.sizeBytes,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Saved to storage, but failed to record');
    }
  };

  const handleDownload = async (a: TaskAttachment) => {
    try {
      setDownloadingId(a.id);
      const url = await fetchFreshDownloadUrl(a.folder as UploadFolder, a.r2Key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRemove = async (a: TaskAttachment) => {
    try {
      await remove.mutateAsync(a.id);
      toast.info('Removed from task. File still in storage.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="size-4" />
            Attachments
          </CardTitle>
          <CardDescription>{attachments.length === 0 ? 'No files attached yet' : `${attachments.length} file${attachments.length === 1 ? '' : 's'} attached`}</CardDescription>
        </div>
        <FileUpload folder="misc" maxSizeMB={50} label="Upload" onUploaded={handleUploaded} />
      </CardHeader>
      <CardContent>
        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={a.name}>{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(a.sizeBytes)} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(a)} disabled={downloadingId === a.id} aria-label="Download">
                    {downloadingId === a.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(a)} aria-label="Remove">
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Relationships (Slice 5 Day 5: time-block, linked SOP, parent task) ────
// Inline-edit pattern: read-only by default, "Edit" toggles selects.
// One "Save" button hits useUpdateTask which records a single activity event.
function RelationshipsCard({ task }: { task: TaskDetail }) {
  const update = useUpdateTask(task.id);
  const { data: sopsPage } = useSops({ status: 'published', limit: 100 });
  // Parent picker excludes self + own children (the BE won't validate this
  // but we don't want the user to accidentally create a cycle).
  const { data: parentCandidatesPage } = useTasks({ limit: 100 });
  const { data: ownChildren } = useTaskChildren(task.id);
  const ownChildIds = new Set((ownChildren ?? []).map((c) => c.id));
  const eligibleParents = (parentCandidatesPage?.tasks ?? []).filter(
    (t) => t.id !== task.id && !ownChildIds.has(t.id),
  );

  const [editing, setEditing] = useState(false);
  const [tb, setTb] = useState<number | null>(task.timeBlockMinutes ?? null);
  const [sop, setSop] = useState<string>(task.linkedSopId ?? '');
  const [parent, setParent] = useState<string>(task.parentTaskId ?? '');
  // Recurrence: preset id ('none' | 'daily' | … | 'custom') drives the
  // dropdown; for 'custom' we hold the raw cron string in customCron.
  const [recurPreset, setRecurPreset] = useState<string>(cronToPresetId(task.recurrenceCron));
  const [customCron, setCustomCron] = useState<string>(
    cronToPresetId(task.recurrenceCron) === 'custom' ? (task.recurrenceCron ?? '') : '',
  );

  const linkedSop = sopsPage?.sops.find((s) => s.id === task.linkedSopId);
  const parentTask = parentCandidatesPage?.tasks.find((t) => t.id === task.parentTaskId);

  // Resolve the picker state to the cron string we send to backend.
  // null = clear recurrence; '' (empty custom) = keep current (treat as no-op).
  function resolveCron(): string | null | undefined {
    if (recurPreset === 'none') return null;
    if (recurPreset === 'custom') {
      const v = customCron.trim();
      return v.length === 0 ? undefined : v;
    }
    const preset = RECURRENCE_PRESETS.find((p) => p.id === recurPreset);
    return preset?.cron ?? null;
  }

  const canSave = (() => {
    if (recurPreset !== 'custom') return true;
    const v = customCron.trim();
    return v.length === 0 || looksLikeCron(v);
  })();

  const handleSave = async () => {
    try {
      const cronValue = resolveCron();
      // Only include recurrenceCron in the payload if it changed — saves a
      // pointless activity event when the user only touched other fields.
      const recurChanged = cronValue !== undefined && cronValue !== task.recurrenceCron;
      await update.mutateAsync({
        timeBlockMinutes: tb,
        linkedSopId: sop || null,
        parentTaskId: parent || null,
        ...(recurChanged ? { recurrenceCron: cronValue } : {}),
      });
      setEditing(false);
      toast.success('Task updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const handleCancel = () => {
    setTb(task.timeBlockMinutes ?? null);
    setSop(task.linkedSopId ?? '');
    setParent(task.parentTaskId ?? '');
    setRecurPreset(cronToPresetId(task.recurrenceCron));
    setCustomCron(cronToPresetId(task.recurrenceCron) === 'custom' ? (task.recurrenceCron ?? '') : '');
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Relationships</CardTitle>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Time block */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />Time block
          </label>
          {editing ? (
            <select
              value={tb === null ? '' : String(tb)}
              onChange={(e) => setTb(e.target.value === '' ? null : Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {TIME_BLOCKS.map((b) => (
                <option key={b.label} value={b.minutes === null ? '' : String(b.minutes)}>{b.label}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm">
              {task.timeBlockMinutes == null
                ? <span className="text-muted-foreground">No estimate</span>
                : (task.timeBlockMinutes < 60
                  ? `${task.timeBlockMinutes} min`
                  : `${(task.timeBlockMinutes / 60).toFixed(task.timeBlockMinutes % 60 === 0 ? 0 : 1)} hr`)}
            </p>
          )}
        </div>

        {/* Linked SOP */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
            <FileText className="size-3.5" />Linked SOP
          </label>
          {editing ? (
            <select
              value={sop}
              onChange={(e) => setSop(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">No linked SOP</option>
              {sopsPage?.sops.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          ) : linkedSop ? (
            <Link to={`/sops/${linkedSop.id}`} className="text-sm text-primary hover:underline">
              {linkedSop.title}
            </Link>
          ) : task.linkedSopId ? (
            <p className="text-sm text-muted-foreground">SOP {task.linkedSopId.slice(0, 8)}…</p>
          ) : (
            <p className="text-sm text-muted-foreground">No linked SOP</p>
          )}
        </div>

        {/* Parent task */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Parent task</label>
          {editing ? (
            <select
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">No parent (top-level)</option>
              {eligibleParents.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          ) : parentTask ? (
            <Link to={`/tasks/${parentTask.id}`} className="text-sm text-primary hover:underline">
              {parentTask.title}
            </Link>
          ) : task.parentTaskId ? (
            <p className="text-sm text-muted-foreground">Task {task.parentTaskId.slice(0, 8)}…</p>
          ) : (
            <p className="text-sm text-muted-foreground">Top-level task</p>
          )}
        </div>

        {/* Recurrence (Slice 5 Day 7 — Sam #96) */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
            <Repeat className="size-3.5" />Repeat
          </label>
          {editing ? (
            <>
              <select
                value={recurPreset}
                onChange={(e) => setRecurPreset(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {RECURRENCE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              {recurPreset === 'custom' && (
                <div className="space-y-1">
                  <Input
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="e.g. */15 9-17 * * 1-5"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    5-field cron: minute hour day-of-month month day-of-week.
                    {customCron.trim() && !looksLikeCron(customCron) && (
                      <span className="text-red-600"> Need 5 space-separated fields.</span>
                    )}
                  </p>
                </div>
              )}
            </>
          ) : task.recurrenceCron ? (
            <div>
              <p className="text-sm">{describeRecurrence(task.recurrenceCron)}</p>
              {task.recurrenceNextRun && (
                <p className="text-xs text-muted-foreground">
                  Next: {formatDateTime(task.recurrenceNextRun)}
                </p>
              )}
              {/* If we showed a friendly label, expose the raw cron too for power users. */}
              {describeRecurrence(task.recurrenceCron) !== task.recurrenceCron && (
                <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded mt-0.5 inline-block">
                  {task.recurrenceCron}
                </code>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No repeat</p>
          )}
        </div>

        {editing && (
          <div className="flex gap-2 pt-2 border-t">
            <Button size="sm" onClick={handleSave} disabled={update.isPending || !canSave}>
              {update.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={update.isPending}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Children (Slice 5 Day 5 — sub-tasks under a project parent) ───────────
function ChildrenCard({ taskId }: { taskId: string }) {
  const { data: children } = useTaskChildren(taskId);
  const rows: TaskSummary[] = children ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Children</CardTitle>
          <CardDescription>{rows.length === 0 ? 'No child tasks yet' : `${rows.length} child task${rows.length === 1 ? '' : 's'}`}</CardDescription>
        </div>
        <Link to={`/tasks/create?parent=${taskId}`}>
          <Button variant="outline" size="sm"><Plus className="size-4 mr-1.5" />Add child</Button>
        </Link>
      </CardHeader>
      {rows.length > 0 && (
        <CardContent>
          <div className="space-y-2">
            {rows.map((c) => (
              <Link
                key={c.id}
                to={`/tasks/${c.id}`}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.assignee || 'Unassigned'}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge className={`text-[10px] capitalize ${priorityColors[c.priority] || ''}`}>{c.priority}</Badge>
                  <Badge className={`text-[10px] capitalize ${statusColors[c.status] || ''}`}>{statusLabels[c.status] || c.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Activity feed (Sam #88) ────────────────────────────────────────────────
function ActivityCard({ activity }: { activity: TaskActivityEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ActivityIcon className="size-4" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet</p>
        ) : (
          <ol className="relative space-y-3 border-l border-border pl-4">
            {activity.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[19px] top-1.5 size-2 rounded-full bg-muted-foreground/40" />
                <p className="text-sm leading-tight">{describeActivity(ev)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(ev.createdAt)}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
