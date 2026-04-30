import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useTask, useUpdateTaskStatus, useAddComment,
  type TaskComment,
} from '@/lib/hooks/use-tasks';

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
    { label: 'Block', next: 'blocked' },
  ],
  in_progress: [
    { label: 'Complete', next: 'completed' },
    { label: 'Block', next: 'blocked' },
  ],
  blocked: [
    { label: 'Unblock', next: 'in_progress' },
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

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: task, isLoading, error } = useTask(id!);
  const updateStatus = useUpdateTaskStatus();
  const addComment = useAddComment();
  const [commentText, setCommentText] = useState('');

  async function handleStatusChange(nextStatus: string) {
    try {
      await updateStatus.mutateAsync({ id: id!, status: nextStatus });
      toast.success(`Task moved to ${statusLabels[nextStatus] || nextStatus}`);
    } catch (err) {
      console.error('Operation failed', err);
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
      console.error('Operation failed', err);
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
          </PageHeader>
        </div>
      </div>

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
            </CardContent>
          </Card>

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
