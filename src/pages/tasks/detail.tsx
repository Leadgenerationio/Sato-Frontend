import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft, Send, Loader2, Plus, Trash2, CheckSquare, Square, Paperclip,
  Download, Activity as ActivityIcon, Repeat, Clock, FileText, ChevronDown,
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

// Statto status-pill class per task status.
const statusPillClass: Record<string, string> = {
  todo: 'st-todo',
  in_progress: 'st-prog',
  on_hold: 'st-hold',
  completed: 'st-done',
  blocked: 'st-hold',
};

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  blocked: 'Blocked',
};

// Statto priority-pill class per priority. Urgent maps to the High visual.
const priorityPillClass: Record<string, string> = {
  urgent: 'prio-high',
  high: 'prio-high',
  medium: 'prio-med',
  low: 'prio-low',
};

// STATUS_TRANSITIONS removed 27 May 2026 — the Actions section now uses
// a free status dropdown so users can move between any pair of statuses
// without being constrained to the curated edges.

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
      <div className="screen-page">
        <div style={{ height: 32, width: 256, background: 'var(--gray-100)', borderRadius: 10 }} />
        <div style={{ height: 160, background: 'var(--gray-100)', borderRadius: 16 }} />
        <div style={{ height: 240, background: 'var(--gray-100)', borderRadius: 16 }} />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="screen-page" style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 64, color: 'var(--fg2)' }}>
        <p>Task not found</p>
        <Link to="/tasks" className="btn b-ghost b-sm">
          <ArrowLeft className="size-4" />Back to tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="screen-page nc-page">
      {/* Header */}
      <div className="page-head">
        <div className="nc-title-row" style={{ flex: 1 }}>
          <Link to="/tasks" className="nc-back" title="Back to tasks"><ArrowLeft className="size-5" /></Link>
          <div style={{ flex: 1 }}>
            <h1 className="ahead-title">{task.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <span className={`tk-prio ${priorityPillClass[task.priority] || ''}`} style={{ textTransform: 'capitalize' }}>
                {task.priority}
              </span>
              <span className={'pill'} style={{ textTransform: 'capitalize' }}>
                {statusLabels[task.status] || task.status}
              </span>
            </div>
          </div>
          {/* Sam-Loom (jam-video #10) — only the task creator sees Delete;
              the backend 403s anyone else and the icon would be a dead-end. */}
          {task.createdBy === user?.email && (
            <button
              type="button"
              className="btn b-ghost b-sm"
              style={{ color: 'var(--negative)' }}
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleteTask.isPending}
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          )}
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
            <button type="button" className="btn b-ghost b-sm" onClick={() => setConfirmDeleteOpen(false)} disabled={deleteTask.isPending}>
              Cancel
            </button>
            <button
              type="button"
              className="btn b-dark b-sm"
              style={{ background: 'var(--negative)' }}
              onClick={handleConfirmDelete}
              disabled={deleteTask.isPending}
            >
              {deleteTask.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete task
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="ct-layout">
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Description */}
          {task.description && (
            <div className="card pad acard">
              <h3 className="statto-title nc-h">Description</h3>
              <p className="ac-sub" style={{ whiteSpace: 'pre-wrap', maxWidth: 'none' }}>{task.description}</p>
            </div>
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
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Comments ({task.comments?.length || 0})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {task.comments?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {task.comments.map((comment: TaskComment) => (
                    <div key={comment.id} className="ec-clientbox" style={{ margin: 0, display: 'flex', gap: 12 }}>
                      <div className="tk-stat-ic plain" style={{ width: 32, height: 32, borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                        {comment.author.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg1)' }}>{comment.author}</span>
                          <span className="nc-hint">{formatDateTime(comment.createdAt)}</span>
                        </div>
                        <p className="ac-sub" style={{ marginTop: 4, whiteSpace: 'pre-wrap', maxWidth: 'none' }}>{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ac-sub">No comments yet</p>
              )}

              {/* Add comment form */}
              <form onSubmit={handleAddComment} style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  className="nc-textarea"
                  style={{ minHeight: 60, flex: 1 }}
                />
                <button type="submit" className="btn b-dark b-sm" disabled={addComment.isPending || !commentText.trim()} aria-label="Add comment">
                  {addComment.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="ct-side" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Info Grid */}
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="tgt-row" style={{ fontSize: 13.5 }}>
                <span className="ac-sub" style={{ margin: 0 }}>Assignee</span>
                <strong style={{ color: 'var(--fg1)' }}>{task.assignee}</strong>
              </div>
              <div className="tgt-row" style={{ fontSize: 13.5 }}>
                <span className="ac-sub" style={{ margin: 0 }}>Category</span>
                <span className="tk-cat">{task.category}</span>
              </div>
              <div className="tgt-row" style={{ fontSize: 13.5 }}>
                <span className="ac-sub" style={{ margin: 0 }}>Due Date</span>
                <strong style={{ color: 'var(--fg1)' }}>{formatDate(task.dueDate)}</strong>
              </div>
              <div className="tgt-row" style={{ fontSize: 13.5 }}>
                <span className="ac-sub" style={{ margin: 0 }}>Created By</span>
                <strong style={{ color: 'var(--fg1)' }}>{task.createdBy}</strong>
              </div>
              <div className="tgt-row" style={{ fontSize: 13.5 }}>
                <span className="ac-sub" style={{ margin: 0 }}>Created At</span>
                <strong style={{ color: 'var(--fg1)' }}>{formatDateTime(task.createdAt)}</strong>
              </div>
              {task.timeBlockMinutes != null && (
                <div className="tgt-row" style={{ fontSize: 13.5 }}>
                  <span className="ac-sub" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Clock className="size-3.5" />Time block
                  </span>
                  <strong style={{ color: 'var(--fg1)' }}>
                    {task.timeBlockMinutes < 60
                      ? `${task.timeBlockMinutes} min`
                      : `${(task.timeBlockMinutes / 60).toFixed(task.timeBlockMinutes % 60 === 0 ? 0 : 1)} hr`}
                  </strong>
                </div>
              )}
              {task.recurrenceCron && (
                <div className="tgt-row" style={{ fontSize: 13.5 }}>
                  <span className="ac-sub" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Repeat className="size-3.5" />Recurrence
                  </span>
                  <code style={{ fontSize: 12, background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 6 }}>{task.recurrenceCron}</code>
                </div>
              )}
            </div>
          </div>

          {/* Activity feed (Sam #88) */}
          <ActivityCard activity={task.activity ?? []} />

          {/* Status Actions — Sam (27 May 2026): "change Actions to dropdown."
              Replaces the previous N Start/Hold/Resume/Complete/Reopen buttons
              with a single status picker mirroring the list view's inline
              dropdown. User can move freely between any pair of statuses,
              not just the curated STATUS_TRANSITIONS edges. */}
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Status</h3>
            <label className="sr-only" htmlFor="task-status-picker">
              Change task status
            </label>
            <div className={'tk-status-wrap ' + (statusPillClass[task.status] || '')} style={{ display: 'flex', width: '100%' }}>
              <select
                id="task-status-picker"
                value={task.status}
                disabled={updateStatus.isPending}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="tk-status"
                style={{ width: '100%', textTransform: 'capitalize' }}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
              <ChevronDown className="size-[14px]" />
            </div>
            {updateStatus.isPending && (
              <p className="nc-hint" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Loader2 className="size-3 animate-spin" /> Saving…
              </p>
            )}
          </div>
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
    <div className="card pad acard">
      <h3 className="statto-title nc-h">Subtasks {subtasks.length > 0 && (
        <span className="ac-sub" style={{ display: 'inline', margin: 0, marginLeft: 6 }}>
          {done}/{subtasks.length} done
        </span>
      )}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {subtasks.length === 0 && (
          <p className="ac-sub">No subtasks yet — add one below.</p>
        )}
        {subtasks.map((s) => (
          <div key={s.id} className="ec-clientbox" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
            <button
              type="button"
              onClick={() => toggleDone(s)}
              aria-label={s.isDone ? 'Mark as not done' : 'Mark as done'}
              style={{ flexShrink: 0, color: 'var(--fg2)', display: 'inline-flex' }}
            >
              {s.isDone ? <CheckSquare className="size-5" style={{ color: 'var(--positive)' }} /> : <Square className="size-5" />}
            </button>
            <span
              style={{ flex: 1, fontSize: 14, ...(s.isDone ? { textDecoration: 'line-through', color: 'var(--fg3)' } : {}) }}
            >
              {s.title}
            </span>
            <button type="button" className="tk-del" onClick={() => handleRemove(s)} aria-label="Remove">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <input
            className="nc-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a subtask…"
          />
          <button type="submit" className="btn b-dark b-sm" disabled={create.isPending || !newTitle.trim()} aria-label="Add subtask">
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </button>
        </form>
      </div>
    </div>
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
    <div className="card pad acard">
      <div className="ac-head">
        <div>
          <h3 className="statto-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Paperclip className="size-4" />
            Attachments
          </h3>
          <p className="ac-sub">{attachments.length === 0 ? 'No files attached yet' : `${attachments.length} file${attachments.length === 1 ? '' : 's'} attached`}</p>
        </div>
        <FileUpload folder="misc" maxSizeMB={50} label="Upload" onUploaded={handleUploaded} />
      </div>
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attachments.map((a) => (
            <div key={a.id} className="ec-clientbox" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
              <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12 }}>
                <div className="tk-stat-ic plain" style={{ width: 36, height: 36, borderRadius: 10 }}>
                  <FileText className="size-4" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.name}>{a.name}</p>
                  <p className="nc-hint">
                    {formatBytes(a.sizeBytes)} · {formatDateTime(a.createdAt)}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 4 }}>
                <button type="button" className="inv-open" onClick={() => handleDownload(a)} disabled={downloadingId === a.id} aria-label="Download">
                  {downloadingId === a.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                </button>
                <button type="button" className="tk-del" onClick={() => handleRemove(a)} aria-label="Remove">
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
    <div className="card pad acard">
      <div className="ac-head">
        <h3 className="statto-title">Relationships</h3>
        {!editing && (
          <button type="button" className="btn b-ghost b-sm" onClick={() => setEditing(true)}>Edit</button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Time block */}
        <div>
          <label className="nc-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Clock className="size-3.5" />Time block
          </label>
          {editing ? (
            <div className="nc-select-wrap">
              <select
                value={tb === null ? '' : String(tb)}
                onChange={(e) => setTb(e.target.value === '' ? null : Number(e.target.value))}
                className="nc-select"
              >
                {TIME_BLOCKS.map((b) => (
                  <option key={b.label} value={b.minutes === null ? '' : String(b.minutes)}>{b.label}</option>
                ))}
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
          ) : (
            <p style={{ fontSize: 14 }}>
              {task.timeBlockMinutes == null
                ? <span className="ac-sub" style={{ margin: 0 }}>No estimate</span>
                : (task.timeBlockMinutes < 60
                  ? `${task.timeBlockMinutes} min`
                  : `${(task.timeBlockMinutes / 60).toFixed(task.timeBlockMinutes % 60 === 0 ? 0 : 1)} hr`)}
            </p>
          )}
        </div>

        {/* Linked SOP */}
        <div>
          <label className="nc-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <FileText className="size-3.5" />Linked SOP
          </label>
          {editing ? (
            <div className="nc-select-wrap">
              <select
                value={sop}
                onChange={(e) => setSop(e.target.value)}
                className="nc-select"
              >
                <option value="">No linked SOP</option>
                {sopsPage?.sops.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
          ) : linkedSop ? (
            <Link to={`/sops/${linkedSop.id}`} style={{ fontSize: 14, color: 'var(--statto-ink)', textDecoration: 'underline' }}>
              {linkedSop.title}
            </Link>
          ) : task.linkedSopId ? (
            <p className="ac-sub" style={{ margin: 0 }}>SOP {task.linkedSopId.slice(0, 8)}…</p>
          ) : (
            <p className="ac-sub" style={{ margin: 0 }}>No linked SOP</p>
          )}
        </div>

        {/* Parent task */}
        <div>
          <label className="nc-label" style={{ marginBottom: 6 }}>Parent task</label>
          {editing ? (
            <div className="nc-select-wrap">
              <select
                value={parent}
                onChange={(e) => setParent(e.target.value)}
                className="nc-select"
              >
                <option value="">No parent (top-level)</option>
                {eligibleParents.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <ChevronDown className="size-[15px]" />
            </div>
          ) : parentTask ? (
            <Link to={`/tasks/${parentTask.id}`} style={{ fontSize: 14, color: 'var(--statto-ink)', textDecoration: 'underline' }}>
              {parentTask.title}
            </Link>
          ) : task.parentTaskId ? (
            <p className="ac-sub" style={{ margin: 0 }}>Task {task.parentTaskId.slice(0, 8)}…</p>
          ) : (
            <p className="ac-sub" style={{ margin: 0 }}>Top-level task</p>
          )}
        </div>

        {/* Recurrence (Slice 5 Day 7 — Sam #96) */}
        <div>
          <label className="nc-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Repeat className="size-3.5" />Repeat
          </label>
          {editing ? (
            <>
              <div className="nc-select-wrap">
                <select
                  value={recurPreset}
                  onChange={(e) => setRecurPreset(e.target.value)}
                  className="nc-select"
                >
                  {RECURRENCE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown className="size-[15px]" />
              </div>
              {recurPreset === 'custom' && (
                <div style={{ marginTop: 8 }}>
                  <input
                    className="nc-input"
                    style={{ fontFamily: 'var(--mono, monospace)', fontSize: 13 }}
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="e.g. */15 9-17 * * 1-5"
                  />
                  <p className="nc-hint" style={{ marginTop: 6 }}>
                    5-field cron: minute hour day-of-month month day-of-week.
                    {customCron.trim() && !looksLikeCron(customCron) && (
                      <span style={{ color: 'var(--negative)' }}> Need 5 space-separated fields.</span>
                    )}
                  </p>
                </div>
              )}
            </>
          ) : task.recurrenceCron ? (
            <div>
              <p style={{ fontSize: 14 }}>{describeRecurrence(task.recurrenceCron)}</p>
              {task.recurrenceNextRun && (
                <p className="nc-hint">
                  Next: {formatDateTime(task.recurrenceNextRun)}
                </p>
              )}
              {/* If we showed a friendly label, expose the raw cron too for power users. */}
              {describeRecurrence(task.recurrenceCron) !== task.recurrenceCron && (
                <code style={{ fontSize: 11, background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 6, marginTop: 4, display: 'inline-block' }}>
                  {task.recurrenceCron}
                </code>
              )}
            </div>
          ) : (
            <p className="ac-sub" style={{ margin: 0 }}>No repeat</p>
          )}
        </div>

        {editing && (
          <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn b-dark b-sm" onClick={handleSave} disabled={update.isPending || !canSave}>
              {update.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </button>
            <button type="button" className="btn b-ghost b-sm" onClick={handleCancel} disabled={update.isPending}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Children (Slice 5 Day 5 — sub-tasks under a project parent) ───────────
function ChildrenCard({ taskId }: { taskId: string }) {
  const { data: children } = useTaskChildren(taskId);
  const rows: TaskSummary[] = children ?? [];

  return (
    <div className="card pad acard">
      <div className="ac-head">
        <div>
          <h3 className="statto-title">Children</h3>
          <p className="ac-sub">{rows.length === 0 ? 'No child tasks yet' : `${rows.length} child task${rows.length === 1 ? '' : 's'}`}</p>
        </div>
        <Link to={`/tasks/create?parent=${taskId}`} className="btn b-ghost b-sm"><Plus className="size-4" />Add child</Link>
      </div>
      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((c) => (
            <Link
              key={c.id}
              to={`/tasks/${c.id}`}
              className="ec-clientbox"
              style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                <p className="nc-hint">{c.assignee || 'Unassigned'}</p>
              </div>
              <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 8 }}>
                <span className={`tk-prio ${priorityPillClass[c.priority] || ''}`} style={{ textTransform: 'capitalize' }}>{c.priority}</span>
                <span className={`tk-prio ${statusPillClass[c.status] || ''}`} style={{ textTransform: 'capitalize' }}>{statusLabels[c.status] || c.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity feed (Sam #88) ────────────────────────────────────────────────
function ActivityCard({ activity }: { activity: TaskActivityEvent[] }) {
  return (
    <div className="card pad acard">
      <h3 className="statto-title nc-h" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ActivityIcon className="size-4" />
        Activity
      </h3>
      {activity.length === 0 ? (
        <p className="ac-sub">No activity yet</p>
      ) : (
        <ol style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '1px solid var(--border)', paddingLeft: 16, margin: 0, listStyle: 'none' }}>
          {activity.map((ev) => (
            <li key={ev.id} style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: -19, top: 6, width: 8, height: 8, borderRadius: 999, background: 'var(--fg3)' }} />
              <p style={{ fontSize: 14, lineHeight: 1.3 }}>{describeActivity(ev)}</p>
              <p className="nc-hint" style={{ marginTop: 2 }}>{formatDateTime(ev.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
