import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Loader2, FileText, Repeat, Sparkles, ChevronDown, Calendar, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateTask, useTaskTemplates, useTasks,
  useGenerateTaskFromPrompt, useTaskCategories,
  type TaskTemplate, type AiTaskSuggestion,
} from '@/lib/hooks/use-tasks';
import { useSops } from '@/lib/hooks/use-sops';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { logError } from '../../lib/log';

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

const priorityPillClass: Record<string, string> = {
  urgent: 'prio-high',
  high: 'prio-high',
  medium: 'prio-med',
  low: 'prio-low',
};

// Statto form field wrapper — label + optional hint above the control.
function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="nc-field">
      <label className="nc-label">{label}</label>
      {children}
      {hint && <span className="nc-hint">{hint}</span>}
    </div>
  );
}

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
  // Sam-Loom (jam-video #5) — saved categories feed the <datalist> below.
  const { data: savedCategories } = useTaskCategories();

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
          logError('Subtask creation failed', err);
          toast.warning('Task created but some subtasks failed — add them on the detail page');
        }
      }

      toast.success(`Task "${task.title}" created`);
      navigate(`/tasks/${task.id}`);
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to create task');
    }
  }

  return (
    <div className="screen-page nc-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/tasks" className="nc-back" title="Back to tasks"><ArrowLeft className="size-5" /></Link>
          <div>
            <h1 className="ahead-title">Create Task</h1>
            <p className="ahead-sub">Add a new task for the team</p>
          </div>
          <button
            type="button"
            className="btn b-ghost b-sm ct-ai"
            onClick={() => setAiOpen(true)}
          >
            <Sparkles className="size-4" />
            Generate with AI
          </button>
        </div>
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
              className="nc-textarea"
              style={{ minHeight: 90 }}
            />
            <p className="ec-hint">
              Keep it short — a sentence is enough. Up to 500 chars.
            </p>
            <DialogFooter>
              <button type="button" className="btn b-ghost b-sm" onClick={() => setAiOpen(false)} disabled={aiGenerate.isPending}>
                Cancel
              </button>
              <button type="submit" className="btn b-dark b-sm" disabled={aiGenerate.isPending || !aiPrompt.trim()}>
                {aiGenerate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Generate
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmit}>
        <div className="ct-layout">
          {/* Form Fields */}
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Task Details</h3>
            <Field label="Title">
              <input
                className="nc-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Review monthly invoices"
              />
            </Field>
            <Field label="Description">
              <textarea
                className="nc-textarea ct-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the task in detail..."
                rows={4}
              />
            </Field>
            <div className="nc-grid2">
              <Field label="Assignee">
                <div className="nc-select-wrap">
                  <select
                    className="nc-select"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                  >
                    <option value="">Select assignee</option>
                    {ASSIGNEES.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
              <Field label="Priority">
                <div className="nc-select-wrap">
                  <select
                    className="nc-select"
                    style={{ textTransform: 'capitalize' }}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
              <Field label="Category">
                {/* Sam-Loom (jam-video #5) — surface previously-used
                    categories via a native <datalist> so the same
                    Marketing/Finance/Compliance buckets stop drifting
                    into typo variants. Still free-form so a brand-new
                    category can be entered on first use. */}
                <input
                  className="nc-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Finance, Operations, Marketing"
                  list="task-category-suggestions"
                />
                <datalist id="task-category-suggestions">
                  {(savedCategories ?? []).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Due Date">
                <div className="ci-date">
                  <Calendar className="size-4" />
                  <DatePicker
                    date={dueDate}
                    onSelect={setDueDate}
                    placeholder="Select due date"
                  />
                </div>
              </Field>
              <Field label="Time block">
                <div className="nc-select-wrap">
                  <select
                    className="nc-select"
                    value={timeBlockMinutes === null ? '' : String(timeBlockMinutes)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTimeBlockMinutes(v === '' ? null : Number(v));
                    }}
                  >
                    {TIME_BLOCKS.map((b) => (
                      <option key={b.label} value={b.minutes === null ? '' : String(b.minutes)}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
              <Field label="Linked SOP">
                <div className="nc-select-wrap">
                  <select
                    className="nc-select"
                    value={linkedSopId}
                    onChange={(e) => setLinkedSopId(e.target.value)}
                  >
                    <option value="">No linked SOP</option>
                    {sopsPage?.sops.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                  <ChevronDown className="size-[15px]" />
                </div>
              </Field>
            </div>
            <Field label="Parent task" hint='Use this to group sub-tasks under a parent "project" task.'>
              <div className="nc-select-wrap">
                <select
                  className="nc-select"
                  value={parentTaskId}
                  onChange={(e) => setParentTaskId(e.target.value)}
                >
                  <option value="">No parent (top-level task)</option>
                  {tasksPage?.tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <ChevronDown className="size-[15px]" />
              </div>
            </Field>
            <Field label={<span className="ct-repeat-l"><Repeat className="size-[15px]" /> Repeat</span>}>
              <div className="nc-select-wrap">
                <select
                  className="nc-select"
                  value={recurPreset}
                  onChange={(e) => setRecurPreset(e.target.value)}
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
              {recurPreset !== 'none' && recurPreset !== 'custom' && (
                <p className="nc-hint" style={{ marginTop: 6 }}>
                  A fresh copy of this task will be auto-created on every fire.
                </p>
              )}
            </Field>
          </div>

          {/* Sidebar */}
          <div className="ct-side" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <button type="submit" className="btn b-dark b-block ct-submit" disabled={createTask.isPending}>
              {createTask.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create Task
            </button>

            {/* AI-suggested subtasks preview (#91) — shown only when AI
                filled them; user can drop any line by clicking ✕ */}
            {pendingSubtasks.length > 0 && (
              <div className="card pad acard">
                <h3 className="statto-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles className="size-4 text-violet-500" />
                  AI-suggested subtasks
                </h3>
                <p className="ac-sub">
                  Will be created after the task. Edit on the detail page.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                  {pendingSubtasks.map((s, i) => (
                    <div key={i} className="ec-clientbox" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
                      <span style={{ flex: 1, fontSize: 13.5 }}>{s}</span>
                      <button
                        type="button"
                        onClick={() => setPendingSubtasks((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label="Remove subtask"
                        className="nc-contact-x"
                        style={{ position: 'static' }}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Templates */}
            {templates && templates.length > 0 && (
              <div className="card pad acard">
                <h3 className="statto-title nc-h">Or create from template</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {templates.map((t: TaskTemplate) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => fillFromTemplate(t)}
                      className="nc-contact"
                      style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', cursor: 'pointer', background: '#fff', padding: 16 }}
                    >
                      <FileText className="size-5" style={{ color: 'var(--fg3)', flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg1)' }}>{t.name}</p>
                        <p className="bf-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <span className={`tk-prio ${priorityPillClass[t.priority] || ''}`} style={{ textTransform: 'capitalize' }}>
                            {t.priority}
                          </span>
                          <span className="tk-cat">{t.category}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
