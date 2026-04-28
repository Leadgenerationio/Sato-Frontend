import { useState } from 'react';
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
  Search, Plus, CheckSquare, Clock, AlertTriangle, ListTodo, LayoutGrid, List,
} from 'lucide-react';
import {
  useTasks, useTaskStats,
  type TaskSummary,
} from '@/lib/hooks/use-tasks';
import { EmptyState } from '@/components/shared/empty-state';

const STATUS_TABS = ['all', 'todo', 'in_progress', 'completed', 'blocked'] as const;

const PRIORITY_OPTIONS = ['all', 'urgent', 'high', 'medium', 'low'] as const;

const statusColors: Record<string, string> = {
  todo: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
  in_progress: 'bg-blue-500/10 text-blue-600 border-blue-200',
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  blocked: 'bg-red-500/10 text-red-600 border-red-200',
};

const statusLabels: Record<string, string> = {
  all: 'All',
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

function formatDate(dateStr: string | null) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const BOARD_COLUMNS = [
  { key: 'todo', label: 'To Do', color: 'bg-neutral-500', dotColor: 'bg-neutral-400' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-500', dotColor: 'bg-blue-500' },
  { key: 'completed', label: 'Completed', color: 'bg-emerald-500', dotColor: 'bg-emerald-500' },
  { key: 'blocked', label: 'Blocked', color: 'bg-red-500', dotColor: 'bg-red-500' },
] as const;

function KanbanBoard({ tasks, navigate }: { tasks: TaskSummary[]; navigate: (path: string) => void }) {
  return (
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
            {/* Cards */}
            <div className="flex flex-col gap-2 min-h-[120px]">
              {columnTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No tasks
                </div>
              ) : (
                columnTasks.map((t) => (
                  <Card
                    key={t.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => navigate(`/tasks/${t.id}`)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium leading-snug line-clamp-2">{t.title}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] capitalize ${priorityColors[t.priority] || ''}`}>
                          {t.priority}
                        </Badge>
                        {t.dueDate && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">{formatDate(t.dueDate)}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.assignee}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TasksPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useTasks({
    status: statusFilter,
    priority: priorityFilter,
    search,
    page,
    limit: 10,
  });
  const { data: stats } = useTaskStats();
  const tasks = data?.tasks;

  const handleStatusChange = (s: string) => { setStatusFilter(s); setPage(1); };
  const handlePriorityChange = (p: string) => { setPriorityFilter(p); setPage(1); };
  const handleSearchChange = (val: string) => { setSearch(val); setPage(1); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tasks" description="Track and manage team tasks">
        <div className="flex items-center gap-2">
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
          <Card>
            <CardContent className="pt-6">
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
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Clock className="size-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.inProgress}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <CheckSquare className="size-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.completedToday}</p>
                  <p className="text-sm text-muted-foreground">Completed Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle className="size-5 text-red-600" />
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
        <div className="flex gap-1 rounded-lg bg-muted p-1">
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
        </div>
        <div className="flex gap-3">
          <select
            value={priorityFilter}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm capitalize"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p === 'all' ? 'All Priorities' : p}</option>
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
      ) : !tasks?.length ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={CheckSquare}
              title="No tasks yet"
              description="Create a task to track work and assign it to a teammate."
              link={{ label: 'New task', to: '/tasks/new', icon: Plus }}
            />
          </CardContent>
        </Card>
      ) : viewMode === 'board' ? (
        <KanbanBoard tasks={tasks} navigate={navigate} />
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
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((t: TaskSummary) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/tasks/${t.id}`)}
                    >
                      <TableCell className="font-medium max-w-[250px] truncate">{t.title}</TableCell>
                      <TableCell className="text-muted-foreground">{t.assignee}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs capitalize ${priorityColors[t.priority] || ''}`}>
                          {t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs capitalize ${statusColors[t.status] || ''}`}>
                          {statusLabels[t.status] || t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">{formatDate(t.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
