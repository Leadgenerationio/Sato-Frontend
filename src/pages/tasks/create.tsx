import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Loader2, FileText, Repeat, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateTask, useTaskTemplates, useTasks,
  useGenerateTaskFromPrompt,
  type TaskTemplate, type AiTaskSuggestion,
} from '@/lib/hooks/use-tasks';
import { useSops } from '@/lib/hooks/use-sops';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

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

// Slice 5 Day 7 — recurrence presets (mirror of detail.tsx). Backend
// auto-computes recurrenceNextRun when only cron is sent.
const RECURRENCE_PRESETS: { id: string; cron: string | null; label: string }[] = [
  { id: 'none',     cron: null,           label: 'No repeat' },
  { id: 'daily',    cron: '0 9 * * *',    label: 'Daily at 09:00' },
  { id: 'weekday',  cron: '0 9 * * 1-5',  label: 'Weekdays at 09:00' },
  { id: 'weekly',   cron: '0 9 * * 1',    label: 'Every Monday at 09:00' },
  { id: 'monthly',  cron: '0 9 1 * *',    label: '1st of every month at 09:00' },
  { id: 'custom',   cron: '',             label: 'Custom…' },
];

function looksLikeCron(s: string): boolean {
  return s.trim().split(/\s+/).filter(Boolean).length === 5;
}

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
  const [recurPreset, setRecurPreset] = useState<string>('none');
  const [customCron, setCustomCron] = useState<string>('');

  // #91 AI new-task — pending subtasks after the AI suggestion lands.
  // The form has no subtasks UI of its own (subtasks live on detail), so
  // we stash the AI-suggested ones and create them post-task-insert.
  const [pendingSubtasks, setPendingSubtasks] = useState<string[]>([]);
  // Dialog state for the prompt input.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const aiGenerate = useGenerateTaskFromPrompt();

  function fillFromTemplate(template: TaskTemplate) {
    setTitle(template.name);
    setDescription(template.description);
    setPriority(template.priority);
    setCategory(template.category);
    toast.success(`Template "${template.name}" applied`);
  }

  function applyAiSuggestion(s: AiTaskSuggestion) {
    setTitle(s.title);
    setDescription(s.description);
    setPriority(s.priority);
    setCategory(s.category);
    setTimeBlockMinutes(s.timeBlockMinutes);
    if (s.linkedSopId) setLinkedSopId(s.linkedSopId);
    setPendingSubtasks(s.subtasks);
  }

  async function handleAiGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    try {
      const suggestion = await aiGenerate.mutateAsync(aiPrompt.trim());
      applyAiSuggestion(suggestion);
      setAiOpen(false);
      setAiPrompt('');
      toast.success('AI suggestion applied — review and edit before saving');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate';
      // 503 → not configured; 502 → bad output. Both should land here as
      // Error.message from the api unwrap helper.
      toast.error(msg);
    }
  }

  // Resolve recurrence picker state → the cron string we send to backend.
  // null = none; valid 5-field cron = set; empty custom = skip (treat as none).
  function resolveRecurrenceCron(): string | null {
    if (recurPreset === 'none') return null;
    if (recurPreset === 'custom') {
      const v = customCron.trim();
      return v.length === 0 ? null : v;
    }
    const preset = RECURRENCE_PRESETS.find((p) => p.id === recurPreset);
    return preset?.cron ?? null;
  }
  const canSaveRecur = recurPreset !== 'custom' || customCron.trim().length === 0 || looksLikeCron(customCron);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error('Task title is required'); return; }
    if (!assignee) { toast.error('Assignee is required'); return; }
    if (!canSaveRecur) { toast.error('Repeat: cron needs 5 space-separated fields'); return; }

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
        recurrenceCron: resolveRecurrenceCron(),
      });

      // #91 — once the task exists, fan out the AI-suggested subtasks.
      // Hit the endpoint directly (useCreateSubtask is bound to a taskId
      // at hook creation, which we don't have until now). Failure here
      // is non-fatal — the task is already created and the user can
      // re-add subtasks manually on the detail page.
      if (pendingSubtasks.length > 0) {
        try {
          await Promise.all(pendingSubtasks.map((subtaskTitle) =>
            api.post(`/api/v1/tasks/${task.id}/subtasks`, { title: subtaskTitle }),
          ));
        } catch (err) {
          console.error('Subtask creation failed', err);
          toast.warning('Task created but some subtasks failed — add them on the detail page');
        }
      }

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
        <PageHeader title="Create Task" description="Add a new task for the team">
          <Button
            type="button"
            variant="outline"
            onClick={() => setAiOpen(true)}
            className="gap-1.5"
          >
            <Sparkles className="size-4 text-violet-500" />
            Generate with AI
          </Button>
        </PageHeader>
      </div>

      {/* #91 AI dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-violet-500" />
              Generate task from a sentence
            </DialogTitle>
            <DialogDescription>
              Describe what needs doing in one line. The AI will draft the title,
              description, subtasks, time estimate, and suggest a linked SOP.
              You can edit everything before saving.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAiGenerate} className="space-y-3">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. monthly Xero VAT export and submission"
              rows={3}
              maxLength={500}
              autoFocus
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Keep it short — a sentence is enough. Up to 500 chars.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAiOpen(false)} disabled={aiGenerate.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={aiGenerate.isPending || !aiPrompt.trim()}>
                {aiGenerate.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Sparkles className="size-4 mr-1.5" />}
                Generate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
              <div className="space-y-2">
                <Label className="inline-flex items-center gap-1.5">
                  <Repeat className="size-3.5" />Repeat
                </Label>
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
                {recurPreset !== 'none' && recurPreset !== 'custom' && (
                  <p className="text-xs text-muted-foreground">
                    A fresh copy of this task will be auto-created on every fire.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            <Button type="submit" className="w-full" disabled={createTask.isPending}>
              {createTask.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Create Task
            </Button>

            {/* AI-suggested subtasks preview (#91) — shown only when AI
                filled them; user can drop any line by clicking ✕ */}
            {pendingSubtasks.length > 0 && (
              <Card className="border-violet-200 bg-violet-50/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="size-4 text-violet-500" />
                    AI-suggested subtasks
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Will be created after the task. Edit on the detail page.
                  </p>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {pendingSubtasks.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5">
                      <span className="flex-1 text-sm">{s}</span>
                      <button
                        type="button"
                        onClick={() => setPendingSubtasks((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label="Remove subtask"
                        className="text-muted-foreground hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

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
