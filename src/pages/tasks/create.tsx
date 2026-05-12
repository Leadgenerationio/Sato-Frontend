import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateTask, useTaskTemplates, useTasks,
  type TaskTemplate,
} from '@/lib/hooks/use-tasks';
import { useSops } from '@/lib/hooks/use-sops';
import { useSearchParams } from 'react-router-dom';

const ASSIGNEES = ['Sam Owner', 'Finance Admin', 'Ops Manager'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

// Slice 5 Day 5 — Sam Loom #94: time-block buckets. Coarse, discoverable
// chunks instead of a free-form minutes input — most ops tasks fall into
// one of these. `null` = no estimate.
const TIME_BLOCKS: { label: string; minutes: number | null }[] = [
  { label: 'No estimate', minutes: null },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: 'Half day', minutes: 240 },
  { label: 'Full day', minutes: 480 },
];

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-600 border-red-200',
  high: 'bg-amber-500/10 text-amber-600 border-amber-200',
  medium: 'bg-blue-500/10 text-blue-600 border-blue-200',
  low: 'bg-neutral-500/10 text-neutral-500 border-neutral-200',
};

export function TaskCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createTask = useCreateTask();
  const { data: templates } = useTaskTemplates();
  // SOP picker pulls published SOPs only — drafts shouldn't be linkable
  // as a "this is the procedure" target.
  const { data: sopsPage } = useSops({ status: 'published', limit: 100 });
  // Parent-task picker: lightweight list, all tasks for now (the org-wide
  // assumption is already in scope from Day 4). Reasonable until we have
  // thousands of tasks.
  const { data: tasksPage } = useTasks({ limit: 100 });

  // Allow pre-seeding parent via `?parent=<taskId>` — "Create child task"
  // links on the detail page use this so we land here with the link set.
  const initialParent = searchParams.get('parent');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [timeBlockMinutes, setTimeBlockMinutes] = useState<number | null>(null);
  const [linkedSopId, setLinkedSopId] = useState<string>('');
  const [parentTaskId, setParentTaskId] = useState<string>(initialParent ?? '');

  function fillFromTemplate(template: TaskTemplate) {
    setTitle(template.name);
    setDescription(template.description);
    setPriority(template.priority);
    setCategory(template.category);
    toast.success(`Template "${template.name}" applied`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error('Task title is required'); return; }
    if (!assignee) { toast.error('Assignee is required'); return; }

    try {
      const task = await createTask.mutateAsync({
        title,
        description,
        assignee,
        priority,
        category,
        dueDate: dueDate ? dueDate.toISOString() : null,
        timeBlockMinutes,
        linkedSopId: linkedSopId || null,
        parentTaskId: parentTaskId || null,
      });
      toast.success(`Task "${task.title}" created`);
      navigate(`/tasks/${task.id}`);
    } catch (err) {
      console.error('Operation failed', err);
      toast.error('Failed to create task');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/tasks"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Create Task" description="Add a new task for the team" />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Form Fields */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Task Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Review monthly invoices"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the task in detail..."
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">Select assignee</option>
                    {ASSIGNEES.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm capitalize"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Finance, Operations, Marketing"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <DatePicker
                    date={dueDate}
                    onSelect={setDueDate}
                    placeholder="Select due date"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Time block</Label>
                  <select
                    value={timeBlockMinutes === null ? '' : String(timeBlockMinutes)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTimeBlockMinutes(v === '' ? null : Number(v));
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    {TIME_BLOCKS.map((b) => (
                      <option key={b.label} value={b.minutes === null ? '' : String(b.minutes)}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Linked SOP</Label>
                  <select
                    value={linkedSopId}
                    onChange={(e) => setLinkedSopId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">No linked SOP</option>
                    {sopsPage?.sops.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Parent task</Label>
                <select
                  value={parentTaskId}
                  onChange={(e) => setParentTaskId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">No parent (top-level task)</option>
                  {tasksPage?.tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Use this to group sub-tasks under a parent "project" task.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            <Button type="submit" className="w-full" disabled={createTask.isPending}>
              {createTask.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Create Task
            </Button>

            {/* Templates */}
            {templates && templates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Or create from template</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {templates.map((t: TaskTemplate) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => fillFromTemplate(t)}
                      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                    >
                      <FileText className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                        <div className="flex gap-2 mt-1.5">
                          <Badge className={`text-xs capitalize ${priorityColors[t.priority] || ''}`}>
                            {t.priority}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
