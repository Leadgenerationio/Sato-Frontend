import { useState, useMemo, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';
import {
  Search, Plus, CheckSquare, Clock, AlertTriangle, ListTodo, LayoutGrid, List, Timer, Trash2, CornerDownRight, Archive,
  ChevronRight, ChevronDown, Square,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  useTasks, useTaskStats, useDeleteTask, useUpdateTaskStatus,
  useTask, useUpdateSubtask,
  type TaskSummary, type TaskSubtask,
} from '@/lib/hooks/use-tasks';
import { useAuth } from '@/components/providers/auth-provider';
import { EmptyState } from '@/components/shared/empty-state';

const STATUS_TABS = ['all', 'todo', 'in_progress', 'on_hold', 'completed'] as const;

const PRIORITY_OPTIONS = ['all', 'urgent', 'high', 'medium', 'low'] as const;

// Sam-Loom (jam-video #6) — additional filters Sam asked for: "I want to
// filter by tasks due today and time. So this one was a 30 minute task.
// Say for example, it's half a day task". Both buckets are applied
// client-side so the backend stays unchanged.
const DUE_OPTIONS = ['all', 'today', 'this_week', 'overdue'] as const;
const DUE_LABELS: Record<string, string> = {
  all: 'Any due',
  today: 'Due today',
  this_week: 'Due this week',
  overdue: 'Overdue',
};

const TIME_OPTIONS = ['all', 'quick', 'normal', 'long'] as const;
const TIME_LABELS: Record<string, string> = {
  all: 'Any duration',
  quick: 'Quick (≤30m)',
  normal: 'Normal (30m–2h)',
  long: 'Long (>2h)',
};

// Sam-Loom #7 — three archive states. 'today' is the default for the active
// board (hides completed work from prior days); 'all' shows everything; the
// dedicated Archived tab maps to 'archive'.
type ArchiveView = 'today' | 'archive' | 'all';

const statusColors: Record<string, string> = {
  todo: 'bg-muted text-muted-foreground border-border',
  in_progress: 'bg-info-bg text-info border-info/30',
  on_hold: 'bg-warning-bg text-warning border-warning/30',
  completed: 'bg-positive-bg text-positive border-positive/30',
};

const statusLabels: Record<string, string> = {
  all: 'All',
  todo: 'To Do',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-negative-bg text-negative border-negative/30',
  high: 'bg-warning-bg text-warning border-warning/30',
  medium: 'bg-info-bg text-info border-info/30',
  low: 'bg-muted text-muted-foreground border-border',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTimeBlock(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes}m`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${(minutes / 60).toFixed(1)}h`;
}

// Sam-Loom #6 — due-date predicates. "Today" is wall-clock today; "this
// week" is the next 7 days; "overdue" is anything past due that isn't
// completed (completed work doesn't count as overdue regardless of date).
function matchesDueFilter(t: TaskSummary, due: string): boolean {
  if (due === 'all' || !t.dueDate) return due === 'all';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const sevenDaysOut = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueAt = new Date(t.dueDate);
  if (due === 'today') return dueAt >= todayStart && dueAt < tomorrowStart;
  if (due === 'this_week') return dueAt >= todayStart && dueAt < sevenDaysOut;
  if (due === 'overdue') return dueAt < todayStart && t.status !== 'completed';
  return true;
}

// Sam-Loom #6 — time-block buckets. Mirrors the AI-task picker enum
// (15/30/60/120/240/480m): Quick covers up to half an hour, Normal up to
// two hours (the common "do it today" range), Long is anything bigger.
function matchesTimeFilter(t: TaskSummary, time: string): boolean {
  if (time === 'all') return true;
  const m = t.timeBlockMinutes;
  if (m == null) return false;
  if (time === 'quick') return m <= 30;
  if (time === 'normal') return m > 30 && m <= 120;
  if (time === 'long') return m > 120;
  return true;
}

const BOARD_COLUMNS = [
  { key: 'todo', label: 'To Do', color: 'bg-muted-foreground', dotColor: 'bg-muted-foreground' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-info', dotColor: 'bg-info' },
  { key: 'on_hold', label: 'On Hold', color: 'bg-warning', dotColor: 'bg-warning' },
  { key: 'completed', label: 'Completed', color: 'bg-positive', dotColor: 'bg-positive' },
] as const;

// Sam-Loom (jam-video #5) — draggable card. dnd-kit handles the pointer/
// keyboard interaction; we just expose the listeners + the visual state.
function DraggableCard({
  task,
  parentTitle,
  navigate,
  onDelete,
  deleting,
  canDelete,
}: {
  task: TaskSummary;
  parentTitle?: string;
  navigate: (path: string) => void;
  onDelete: (taskId: string, title: string) => void;
  deleting: boolean;
  // Sam-Loom (jam-video #10) — backend now 403s a non-creator's DELETE;
  // hide the icon for non-creators so the affordance matches the rule.
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-50' : ''}
    >
      <Card
        className="cursor-grab transition-colors hover:bg-muted/50 group active:cursor-grabbing"
        onClick={(e) => {
          // Treat as a click only if the pointer hasn't moved more than the
          // dnd-kit activation distance. We rely on dnd-kit to swallow the
          // event when a real drag starts; everything else is a click.
          if (!isDragging) navigate(`/tasks/${task.id}`);
          e.stopPropagation();
        }}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm font-medium leading-snug line-clamp-2">{task.title}</p>
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${task.title}`}
                className="size-6 -m-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={(e) => { e.stopPropagation(); onDelete(task.id, task.title); }}
                disabled={deleting}
              >
                <Trash2 className="size-3.5 text-negative" />
              </Button>
            )}
          </div>
          {(parentTitle || task.parentTitle) && (
            // Sam-Loom #2 — surfaces the parent → child link on the card so
            // "I wouldn't know these two are connected while looking at a
            // screen" becomes "↪ Parent: Foo" with the arrow as a visual cue.
            // Prefer the in-page title (cached freshness), fall back to the
            // BE-provided field for cross-page parents.
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground italic">
              <CornerDownRight className="size-3" />
              <span className="truncate">{parentTitle ?? task.parentTitle}</span>
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] capitalize ${priorityColors[task.priority] || ''}`}>
              {task.priority}
            </Badge>
            {formatTimeBlock(task.timeBlockMinutes) && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground tabular-nums">
                <Timer className="size-3" />{formatTimeBlock(task.timeBlockMinutes)}
              </span>
            )}
            {task.dueDate && (
              <span className="text-[10px] text-muted-foreground tabular-nums">{formatDate(task.dueDate)}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{task.assignee}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Sam-Loom #5 — column accepts drops and lights up while a card is over it.
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 min-h-[120px] rounded-lg transition-colors ${
        isOver ? 'bg-muted/50 ring-2 ring-primary/30' : ''
      }`}
    >
      {children}
    </div>
  );
}

function KanbanBoard({
  tasks,
  parentTitleById,
  navigate,
  onDelete,
  deleting,
  onMoveStatus,
  currentUserEmail,
}: {
  tasks: TaskSummary[];
  parentTitleById: Map<string, string>;
  navigate: (path: string) => void;
  onDelete: (taskId: string, title: string) => void;
  deleting: boolean;
  onMoveStatus: (taskId: string, status: string) => void;
  currentUserEmail: string;
}) {
  // Require a small pointer movement before a drag starts — otherwise every
  // click on a card would be interpreted as a drag and the navigate-on-click
  // would never fire. 5px is the dnd-kit default for this pattern.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const targetStatus = String(over.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;
    onMoveStatus(taskId, targetStatus);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BOARD_COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1">
                <div className={`size-2.5 rounded-full ${col.dotColor}`} />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{columnTasks.length}</span>
              </div>
              <DroppableColumn id={col.key}>
                {columnTasks.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No tasks
                  </div>
                ) : (
                  columnTasks.map((t) => (
                    <DraggableCard
                      key={t.id}
                      task={t}
                      parentTitle={t.parentTaskId ? parentTitleById.get(t.parentTaskId) : undefined}
                      navigate={navigate}
                      onDelete={onDelete}
                      deleting={deleting}
                      canDelete={t.createdBy === currentUserEmail}
                    />
                  ))
                )}
              </DroppableColumn>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}

// Slice 5 Day 4 — Sam Loom #99: "I can overlook everyone in the business and
// see all their tasks". `scope` toggles between My tasks (filter on the
// current user's email/name) and All tasks (no assignee filter). Pinned
// to localStorage so each staff member sees their preferred default.
const SCOPE_KEY = 'stato:tasks:scope';

// Sam (27 May 2026) — Task and subtasks in folders, option (a). Each
// list-view row renders this component when expanded. Lazy-loads the
// task's subtasks via useTask(id) and renders them as indented
// sub-rows. Subtask checkbox toggles isDone inline through the same
// optimistic useUpdateSubtask hook the detail page uses.
function SubtaskFolderRows({ taskId, depth }: { taskId: string; depth: number }) {
  const { data: task, isLoading } = useTask(taskId);
  const update = useUpdateSubtask(taskId);
  // Title cell sits in col 1; we span every other column with the
  // status/footer info so the layout doesn't shear.
  const indentPx = `${(depth + 1) * 2.25}rem`;

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={8} style={{ paddingLeft: indentPx }} className="text-xs text-muted-foreground bg-muted/20">
          Loading subtasks…
        </TableCell>
      </TableRow>
    );
  }
  const subtasks = task?.subtasks ?? [];
  if (subtasks.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={8} style={{ paddingLeft: indentPx }} className="text-xs text-muted-foreground italic bg-muted/20">
          No subtasks yet — open the task to add one.
        </TableCell>
      </TableRow>
    );
  }

  const toggle = (s: TaskSubtask) =>
    update.mutateAsync({ subtaskId: s.id, isDone: !s.isDone }).catch((err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update subtask');
    });

  return (
    <>
      {subtasks.map((s) => (
        <TableRow key={s.id} className="bg-muted/20 hover:bg-muted/30">
          <TableCell colSpan={8} style={{ paddingLeft: indentPx }} className="py-2">
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => toggle(s)}
                aria-label={s.isDone ? `Mark "${s.title}" not done` : `Mark "${s.title}" done`}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                {s.isDone
                  ? <CheckSquare className="size-4 text-positive" />
                  : <Square className="size-4" />}
              </button>
              <span className={`truncate ${s.isDone ? 'line-through text-muted-foreground' : ''}`}>
                {s.title}
              </span>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function TasksPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dueFilter, setDueFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  // Sam-Loom #7 — archive view. 'today' default (hide old completed),
  // 'archive' shows ONLY older completed work, 'all' disables the filter.
  const [archiveView, setArchiveView] = useState<ArchiveView>('today');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<'all' | 'mine'>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(SCOPE_KEY) : null;
    return stored === 'mine' ? 'mine' : 'all';
  });
  const handleScopeChange = (s: 'all' | 'mine') => {
    setScope(s); setPage(1);
    try { localStorage.setItem(SCOPE_KEY, s); } catch { /* ignore */ }
  };

  // Sam (27 May 2026) "Task and subtasks in folders" — list-view rows
  // now have a chevron that expands to show their subtasks indented
  // underneath, file-tree style. Lazy-loaded via useTask(id) per row so
  // we don't fetch subtasks for every task on the page on mount.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // "My tasks" filters by the user's name OR email — backend assignee field
  // is free text, set at create time to a name in most cases.
  const myAssignee = user ? (user.name || user.email) : '';

  const { data, isLoading, error } = useTasks({
    status: statusFilter,
    priority: priorityFilter,
    search,
    assignee: scope === 'mine' ? myAssignee : undefined,
    archive: archiveView,
    page,
    limit: 50, // larger page so parent + children are likely co-resident
  });
  const { data: stats } = useTaskStats();
  const deleteTask = useDeleteTask();
  const updateStatus = useUpdateTaskStatus();

  const handleDelete = async (taskId: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This permanently removes the task and its subtasks/attachments.`)) {
      return;
    }
    try {
      await deleteTask.mutateAsync(taskId);
      toast.success(`Deleted "${title}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Sam-Loom #8 — inline status dropdown. Stops propagation so the row
  // click doesn't fire too, and shows a toast on failure (success is
  // visible via the badge updating).
  const handleStatusInline = async (taskId: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id: taskId, status });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status change failed');
    }
  };

  const rawTasks = data?.tasks ?? [];

  // Apply due + time filters client-side (BE doesn't know these buckets).
  const filteredTasks = useMemo(() => {
    return rawTasks.filter((t) => matchesDueFilter(t, dueFilter) && matchesTimeFilter(t, timeFilter));
  }, [rawTasks, dueFilter, timeFilter]);

  // Sam-Loom #2 — parent → title lookup for the board card hint. Built from
  // whatever's on the current page (used to decide indentation in the list
  // view). The BE now populates `parentTitle` on each row directly, so
  // off-page parents still get the "↪ <title>" hint — this map only covers
  // the indent grouping case where parent + child are co-resident.
  const parentTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of rawTasks) map.set(t.id, t.title);
    return map;
  }, [rawTasks]);

  // Sam-Loom #2 — group rows so parents lead, then their children indented
  // beneath. Orphans (parent off-page or null) stay top-level. Stable order:
  // preserve the BE's createdAt-desc ordering within each group.
  const groupedTasks = useMemo(() => {
    const childrenByParent = new Map<string, TaskSummary[]>();
    const topLevel: TaskSummary[] = [];
    for (const t of filteredTasks) {
      if (t.parentTaskId && parentTitleById.has(t.parentTaskId)) {
        const list = childrenByParent.get(t.parentTaskId) ?? [];
        list.push(t);
        childrenByParent.set(t.parentTaskId, list);
      } else {
        topLevel.push(t);
      }
    }
    const rows: Array<{ task: TaskSummary; depth: number }> = [];
    for (const parent of topLevel) {
      rows.push({ task: parent, depth: 0 });
      const kids = childrenByParent.get(parent.id) ?? [];
      for (const kid of kids) rows.push({ task: kid, depth: 1 });
    }
    return rows;
  }, [filteredTasks, parentTitleById]);

  const tasksToShow = filteredTasks; // board uses the flat filtered list
  const showingArchived = archiveView === 'archive';

  const handleStatusChange = (s: string) => { setStatusFilter(s); setPage(1); };
  const handlePriorityChange = (p: string) => { setPriorityFilter(p); setPage(1); };
  const handleSearchChange = (val: string) => { setSearch(val); setPage(1); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tasks" description="Track and manage team tasks">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => handleScopeChange('mine')}
              className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                scope === 'mine'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              My tasks
            </button>
            <button
              onClick={() => handleScopeChange('all')}
              className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                scope === 'all'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All tasks
            </button>
          </div>
          <div className="flex rounded-lg bg-muted p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="size-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'board'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="size-4" />
              Board
            </button>
          </div>
          <Link to="/tasks/create">
            <Button>
              <Plus className="size-4 mr-1.5" />
              New Task
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="gap-3 py-5">
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <ListTodo className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="gap-3 py-5">
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-info-bg">
                  <Clock className="size-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.inProgress}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="gap-3 py-5">
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-positive-bg">
                  <CheckSquare className="size-5 text-positive" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.completedToday}</p>
                  <p className="text-sm text-muted-foreground">Completed Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="gap-3 py-5">
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-negative-bg">
                  <AlertTriangle className="size-5 text-negative" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.overdue}</p>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleStatusChange(tab)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {statusLabels[tab] || tab}
            </button>
          ))}
          {/* Sam-Loom #7 — Archived tab. Toggles the BE archive filter on/off.
              Stays in the same tab strip so it reads as a sibling of the
              status tabs rather than a separate gear. */}
          <button
            onClick={() => setArchiveView(showingArchived ? 'today' : 'archive')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              showingArchived
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={showingArchived}
          >
            <Archive className="size-3.5" />
            Archived
          </button>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select
            value={priorityFilter}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm capitalize"
            aria-label="Filter by priority"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p === 'all' ? 'All Priorities' : p}</option>
            ))}
          </select>
          <select
            value={dueFilter}
            onChange={(e) => { setDueFilter(e.target.value); setPage(1); }}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            aria-label="Filter by due date"
          >
            {DUE_OPTIONS.map((d) => (
              <option key={d} value={d}>{DUE_LABELS[d]}</option>
            ))}
          </select>
          <select
            value={timeFilter}
            onChange={(e) => { setTimeFilter(e.target.value); setPage(1); }}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            aria-label="Filter by duration"
          >
            {TIME_OPTIONS.map((tm) => (
              <option key={tm} value={tm}>{TIME_LABELS[tm]}</option>
            ))}
          </select>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Content: List or Board */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load tasks"
              description="Something went wrong reaching the server. Try refreshing the page."
            />
          </CardContent>
        </Card>
      ) : !tasksToShow.length ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={showingArchived ? Archive : CheckSquare}
              title={
                showingArchived
                  ? 'Archive is empty'
                  : (search || statusFilter !== 'all' || priorityFilter !== 'all' || dueFilter !== 'all' || timeFilter !== 'all'
                      ? 'No matching tasks'
                      : 'No tasks yet')
              }
              description={
                showingArchived
                  ? 'Tasks land here automatically the day after they\'re marked completed.'
                  : (search || statusFilter !== 'all' || priorityFilter !== 'all' || dueFilter !== 'all' || timeFilter !== 'all'
                      ? 'Try a different search or filter.'
                      : 'Create a task to track work and assign it to a teammate.')
              }
              link={
                showingArchived || search || statusFilter !== 'all' || priorityFilter !== 'all' || dueFilter !== 'all' || timeFilter !== 'all'
                  ? undefined
                  : { label: 'New task', to: '/tasks/new', icon: Plus }
              }
            />
          </CardContent>
        </Card>
      ) : viewMode === 'board' ? (
        <KanbanBoard
          tasks={tasksToShow}
          parentTitleById={parentTitleById}
          navigate={navigate}
          onDelete={handleDelete}
          deleting={deleteTask.isPending}
          onMoveStatus={handleStatusInline}
          currentUserEmail={user?.email ?? ''}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-12 text-right" aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedTasks.map(({ task: t, depth }) => {
                    const isExpanded = expandedIds.has(t.id);
                    return (
                    <Fragment key={t.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => navigate(`/tasks/${t.id}`)}
                    >
                      <TableCell
                        className="max-w-[140px] truncate font-medium sm:max-w-[250px]"
                        style={{ paddingLeft: depth === 1 ? '2.25rem' : undefined }}
                      >
                        {/* Sam-Loom #2 — child rows indent + show a corner glyph so
                            the parent/child relationship reads at a glance.
                            Pagination edge case: when the parent is on a different
                            page, depth stays 0 but parentTitle is still populated by
                            the BE — render a small italic hint so the link still
                            reads on screen.
                            Sam (27 May 2026) — chevron toggle expands the row to
                            show its subtasks below, file-tree style. */}
                        <span className="inline-flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleExpanded(t.id); }}
                              aria-label={`${isExpanded ? 'Hide' : 'Show'} subtasks for ${t.title}`}
                              aria-expanded={isExpanded}
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded
                                ? <ChevronDown className="size-3.5" />
                                : <ChevronRight className="size-3.5" />}
                            </button>
                            {depth === 1 && <CornerDownRight className="size-3.5 text-muted-foreground shrink-0" />}
                            <span className="truncate">{t.title}</span>
                          </span>
                          {depth === 0 && t.parentTaskId && t.parentTitle && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground italic">
                              <CornerDownRight className="size-3 shrink-0" />
                              <span className="truncate">{t.parentTitle}</span>
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.assignee}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs capitalize ${priorityColors[t.priority] || ''}`}>
                          {t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {/* Sam-Loom #8 — inline status dropdown. Sam: "we just have a
                            dropdown where we can select the status somewhere". Native
                            <select> keeps the bundle small + the dropdown native to
                            the platform (mobile, keyboard). */}
                        <select
                          value={t.status}
                          onChange={(e) => handleStatusInline(t.id, e.target.value)}
                          aria-label={`Change status for ${t.title}`}
                          className={`h-7 rounded-md border border-input bg-transparent px-2 py-0 text-xs font-medium ${statusColors[t.status] || ''}`}
                          disabled={updateStatus.isPending}
                        >
                          {BOARD_COLUMNS.map((col) => (
                            <option key={col.key} value={col.key}>{col.label}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">{formatDate(t.dueDate)}</TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatTimeBlock(t.timeBlockMinutes) ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <Timer className="size-3.5" />{formatTimeBlock(t.timeBlockMinutes)}
                          </span>
                        ) : (
                          <span className="text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {/* Row-click navigates to detail; the delete button has to
                            stopPropagation or it'd open the task and delete simultaneously.
                            Sam-Loom (jam-video #10) — only the creator sees the delete
                            icon; the BE returns 403 for anyone else. */}
                        {t.createdBy === user?.email && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${t.title}`}
                            onClick={() => handleDelete(t.id, t.title)}
                            disabled={deleteTask.isPending}
                          >
                            <Trash2 className="size-4 text-negative" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && <SubtaskFolderRows taskId={t.id} depth={depth} />}
                    </Fragment>
                  );})}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          {data && data.total > 0 && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={setPage}
            />
          )}
        </Card>
      )}
    </div>
  );
}
