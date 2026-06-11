import { useState, useMemo, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Plus, CheckSquare, Clock, AlertTriangle, ListTodo, LayoutGrid, List, Timer, Trash2, CornerDownRight, Archive,
  ChevronRight, ChevronDown, ChevronLeft, Square,
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
import { FilterSelect } from '@/components/ui/filter-select';

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

// Statto status-pill class per task status (drives the inline dropdown chip).
const statusPillClass: Record<string, string> = {
  todo: 'st-todo',
  in_progress: 'st-prog',
  on_hold: 'st-hold',
  completed: 'st-done',
};

const statusLabels: Record<string, string> = {
  all: 'All',
  todo: 'To Do',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
};

// Statto priority-pill class per priority. Urgent maps to the High visual.
const priorityPillClass: Record<string, string> = {
  urgent: 'prio-high',
  high: 'prio-high',
  medium: 'prio-med',
  low: 'prio-low',
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
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'completed', label: 'Completed' },
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
      <div
        className="tk-mini"
        style={{ cursor: 'grab' }}
        onClick={(e) => {
          // Treat as a click only if the pointer hasn't moved more than the
          // dnd-kit activation distance. We rely on dnd-kit to swallow the
          // event when a real drag starts; everything else is a click.
          if (!isDragging) navigate(`/tasks/${task.id}`);
          e.stopPropagation();
        }}
      >
        <div className="tk-mini-title" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ flex: 1 }}>{task.title}</span>
          {canDelete && (
            <button
              type="button"
              className="tk-del"
              aria-label={`Delete ${task.title}`}
              onClick={(e) => { e.stopPropagation(); onDelete(task.id, task.title); }}
              disabled={deleting}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
        {(parentTitle || task.parentTitle) && (
          // Sam-Loom #2 — surfaces the parent → child link on the card so
          // "I wouldn't know these two are connected while looking at a
          // screen" becomes "↪ Parent: Foo" with the arrow as a visual cue.
          // Prefer the in-page title (cached freshness), fall back to the
          // BE-provided field for cross-page parents.
          <div className="tk-mini-parent">
            <CornerDownRight className="size-3" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parentTitle ?? task.parentTitle}</span>
          </div>
        )}
        <div className="tk-mini-meta">
          <span className={`tk-prio ${priorityPillClass[task.priority] || ''}`} style={{ textTransform: 'capitalize' }}>
            {task.priority}
          </span>
          {formatTimeBlock(task.timeBlockMinutes) && (
            <span className="tk-time">
              <Timer className="size-3" />{formatTimeBlock(task.timeBlockMinutes)}
            </span>
          )}
          {task.dueDate && (
            <span className="tk-mini-due">{formatDate(task.dueDate)}</span>
          )}
        </div>
        <div className="tk-mini-foot"><span className="tk-assignee">{task.assignee}</span></div>
      </div>
    </div>
  );
}

// Sam-Loom #5 — column accepts drops and lights up while a card is over it.
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="tk-col-body"
      style={isOver ? { outline: '2px solid var(--statto-ink)', outlineOffset: 2, borderRadius: 12 } : undefined}
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
      <div className="tk-board">
        {BOARD_COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="tk-col">
              {/* Column header */}
              <div className="tk-col-head">
                <span className={`tk-col-dot ${statusPillClass[col.key] || ''}`} />
                {col.label}
                <span className="tk-col-n">{columnTasks.length}</span>
              </div>
              <DroppableColumn id={col.key}>
                {columnTasks.length === 0 ? (
                  <div className="tk-col-empty">No tasks</div>
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
      <tr>
        <td colSpan={8} style={{ paddingLeft: indentPx }} className="tk-assignee">
          Loading subtasks…
        </td>
      </tr>
    );
  }
  const subtasks = task?.subtasks ?? [];
  if (subtasks.length === 0) {
    return (
      <tr>
        <td colSpan={8} style={{ paddingLeft: indentPx, fontStyle: 'italic' }} className="tk-assignee">
          No subtasks yet — open the task to add one.
        </td>
      </tr>
    );
  }

  const toggle = (s: TaskSubtask) =>
    update.mutateAsync({ subtaskId: s.id, isDone: !s.isDone }).catch((err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update subtask');
    });

  return (
    <>
      {subtasks.map((s) => (
        <tr key={s.id}>
          <td colSpan={8} style={{ paddingLeft: indentPx }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => toggle(s)}
                aria-label={s.isDone ? `Mark "${s.title}" not done` : `Mark "${s.title}" done`}
                style={{ flexShrink: 0, color: 'var(--fg2)' }}
              >
                {s.isDone
                  ? <CheckSquare className="size-4" style={{ color: 'var(--positive)' }} />
                  : <Square className="size-4" />}
              </button>
              <span
                className="tk-title-text sub"
                style={s.isDone ? { textDecoration: 'line-through', color: 'var(--fg3)' } : undefined}
              >
                {s.title}
              </span>
            </div>
          </td>
        </tr>
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

  const STAT_TILES = stats ? [
    { icon: ListTodo, value: stats.total, label: 'Total Tasks', tint: 'plain' },
    { icon: Clock, value: stats.inProgress, label: 'In Progress', tint: 'info' },
    { icon: CheckSquare, value: stats.completedToday, label: 'Completed Today', tint: 'pos' },
    { icon: AlertTriangle, value: stats.overdue, label: 'Overdue', tint: 'neg' },
  ] : [];

  return (
    <div className="screen-page">
      <div className="page-head tk-head">
        <div>
          <h1 className="ahead-title">Tasks</h1>
          <p className="ahead-sub">Track and manage team tasks</p>
        </div>
        <div className="tk-head-tools">
          <div className="seg tk-seg">
            <button
              className={'seg-btn' + (scope === 'mine' ? ' on' : '')}
              onClick={() => handleScopeChange('mine')}
            >
              My tasks
            </button>
            <button
              className={'seg-btn' + (scope === 'all' ? ' on' : '')}
              onClick={() => handleScopeChange('all')}
            >
              All tasks
            </button>
          </div>
          <div className="seg tk-seg">
            <button
              className={'seg-btn' + (viewMode === 'list' ? ' on' : '')}
              onClick={() => setViewMode('list')}
            >
              <List className="size-4" /> List
            </button>
            <button
              className={'seg-btn' + (viewMode === 'board' ? ' on' : '')}
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="size-4" /> Board
            </button>
          </div>
          <Link to="/tasks/create">
            <button className="btn b-dark b-sm">
              <Plus className="size-4" /> New Task
            </button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="tk-stat-row">
          {STAT_TILES.map((s) => (
            <div key={s.label} className="tk-stat">
              <span className={'tk-stat-ic ' + s.tint}><s.icon className="size-5" /></span>
              <div>
                <div className="tk-stat-v">{s.value}</div>
                <div className="tk-stat-l">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="tk-filters">
        <div className="tk-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleStatusChange(tab)}
              className={'tk-tab' + (statusFilter === tab ? ' on' : '')}
            >
              {statusLabels[tab] || tab}
            </button>
          ))}
          {/* Sam-Loom #7 — Archived tab. Toggles the BE archive filter on/off.
              Stays in the same tab strip so it reads as a sibling of the
              status tabs rather than a separate gear. */}
          <button
            onClick={() => setArchiveView(showingArchived ? 'today' : 'archive')}
            className={'tk-tab' + (showingArchived ? ' on' : '')}
            aria-pressed={showingArchived}
          >
            <Archive className="size-3.5" />
            Archived
          </button>
        </div>
        <div className="tk-filter-right">
          <FilterSelect
            value={priorityFilter}
            onChange={handlePriorityChange}
            ariaLabel="Filter by priority"
            capitalize
            options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p === 'all' ? 'All Priorities' : p }))}
          />
          <FilterSelect
            value={dueFilter}
            onChange={(v) => { setDueFilter(v); setPage(1); }}
            ariaLabel="Filter by due date"
            options={DUE_OPTIONS.map((d) => ({ value: d, label: DUE_LABELS[d] }))}
          />
          <FilterSelect
            value={timeFilter}
            onChange={(v) => { setTimeFilter(v); setPage(1); }}
            ariaLabel="Filter by duration"
            options={TIME_OPTIONS.map((tm) => ({ value: tm, label: TIME_LABELS[tm] }))}
          />
        </div>
      </div>
      <div className="inv-search tk-search">
        <Search className="size-4" />
        <input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Content: List or Board */}
      {isLoading ? (
        <div className="card acard inv-card">
          <table className="inv-table tk-table">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8}>
                    <div style={{ height: 20, background: 'var(--gray-100)', borderRadius: 8 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : error ? (
        <div className="card acard">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load tasks"
            description="Something went wrong reaching the server. Try refreshing the page."
          />
        </div>
      ) : !tasksToShow.length ? (
        <div className="card acard">
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
        </div>
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
        <div className="card acard inv-card">
          <table className="inv-table tk-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Assignee</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Time</th>
                <th>Category</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {groupedTasks.map(({ task: t, depth }) => {
                const isExpanded = expandedIds.has(t.id);
                return (
                <Fragment key={t.id}>
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/tasks/${t.id}`)}
                >
                  <td>
                    {/* Sam-Loom #2 — child rows indent + show a corner glyph so
                        the parent/child relationship reads at a glance.
                        Pagination edge case: when the parent is on a different
                        page, depth stays 0 but parentTitle is still populated by
                        the BE — render a small italic hint so the link still
                        reads on screen.
                        Sam (27 May 2026) — chevron toggle expands the row to
                        show its subtasks below, file-tree style. */}
                    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, paddingLeft: depth === 1 ? '1.75rem' : undefined }}>
                      <span className="tk-title">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleExpanded(t.id); }}
                          aria-label={`${isExpanded ? 'Hide' : 'Show'} subtasks for ${t.title}`}
                          aria-expanded={isExpanded}
                          style={{ flexShrink: 0, color: 'var(--fg3)', display: 'inline-flex' }}
                        >
                          {isExpanded
                            ? <ChevronDown className="size-[15px]" />
                            : <ChevronRight className="size-[15px]" />}
                        </button>
                        {depth === 1 && <CornerDownRight className="size-[15px]" />}
                        <span className={'tk-title-text' + (depth === 1 ? ' sub' : '')}>{t.title}</span>
                      </span>
                      {depth === 0 && t.parentTaskId && t.parentTitle && (
                        <span className="tk-mini-parent" style={{ marginBottom: 0 }}>
                          <CornerDownRight className="size-3" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.parentTitle}</span>
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="tk-assignee">{t.assignee}</td>
                  <td>
                    <span className={`tk-prio ${priorityPillClass[t.priority] || ''}`} style={{ textTransform: 'capitalize' }}>
                      {t.priority}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {/* Sam-Loom #8 — inline status dropdown. Sam: "we just have a
                        dropdown where we can select the status somewhere". Native
                        <select> keeps the bundle small + the dropdown native to
                        the platform (mobile, keyboard). */}
                    <div className={'tk-status-wrap ' + (statusPillClass[t.status] || '')}>
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusInline(t.id, e.target.value)}
                        aria-label={`Change status for ${t.title}`}
                        className="tk-status"
                        disabled={updateStatus.isPending}
                      >
                        {BOARD_COLUMNS.map((col) => (
                          <option key={col.key} value={col.key}>{col.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="size-[14px]" />
                    </div>
                  </td>
                  <td className="inv-date">{formatDate(t.dueDate)}</td>
                  <td>
                    {formatTimeBlock(t.timeBlockMinutes) ? (
                      <span className="tk-time">
                        <Timer className="size-[14px]" />{formatTimeBlock(t.timeBlockMinutes)}
                      </span>
                    ) : (
                      <span className="tk-assignee">—</span>
                    )}
                  </td>
                  <td>
                    <span className="tk-cat">{t.category}</span>
                  </td>
                  <td className="r" onClick={(e) => e.stopPropagation()}>
                    {/* Row-click navigates to detail; the delete button has to
                        stopPropagation or it'd open the task and delete simultaneously.
                        Sam-Loom (jam-video #10) — only the creator sees the delete
                        icon; the BE returns 403 for anyone else. */}
                    {t.createdBy === user?.email && (
                      <button
                        type="button"
                        className="tk-del"
                        aria-label={`Delete ${t.title}`}
                        onClick={() => handleDelete(t.id, t.title)}
                        disabled={deleteTask.isPending}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
                {isExpanded && <SubtaskFolderRows taskId={t.id} depth={depth} />}
                </Fragment>
              );})}
            </tbody>
          </table>
          {data && data.total > 0 && (
            <div className="bf-pager">
              <span className="bf-count">
                Showing <strong>{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)}</strong> of <strong>{data.total}</strong>
              </span>
              <div className="bf-pages">
                <button
                  className="bf-pg-btn"
                  disabled={data.page <= 1}
                  onClick={() => setPage(data.page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button className="bf-pg-btn on">{data.page}</button>
                <button
                  className="bf-pg-btn"
                  disabled={data.page * data.pageSize >= data.total}
                  onClick={() => setPage(data.page + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
