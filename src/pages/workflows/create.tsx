import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateWorkflow } from '@/lib/hooks/use-workflows';

const STEP_TYPES = ['data_fetch', 'calculation', 'approval', 'action', 'notification', 'wait', 'api_call', 'query'];

interface StepDraft {
  name: string;
  type: string;
  config: string;
}

export function WorkflowCreatePage() {
  const navigate = useNavigate();
  const createWorkflow = useCreateWorkflow();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('scheduled');
  const [schedule, setSchedule] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [day, setDay] = useState('Monday');
  const [time, setTime] = useState('09:00');

  function buildSchedule(freq: string, d: string, t: string) {
    const formatted = new Date(`2000-01-01T${t}`).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
    if (freq === 'daily') setSchedule(`Daily ${formatted}`);
    else if (freq === 'weekly') setSchedule(`Every ${d} ${formatted}`);
    else if (freq === 'monthly') {
      const suffix = d === '1' ? 'st' : d === '2' ? 'nd' : d === '3' ? 'rd' : 'th';
      setSchedule(`${d}${suffix} of month ${formatted}`);
    }
  }
  const [steps, setSteps] = useState<StepDraft[]>([
    { name: '', type: 'data_fetch', config: '' },
  ]);

  function addStep() {
    setSteps((prev) => [...prev, { name: '', type: 'action', config: '' }]);
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: keyof StepDraft, value: string) {
    setSteps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Workflow name is required'); return; }
    if (steps.some((s) => !s.name.trim())) { toast.error('All steps need a name'); return; }

    try {
      const wf = await createWorkflow.mutateAsync({
        name,
        description,
        type: type as any,
        scheduleConfig: type === 'scheduled' ? { frequency: frequency as any, day, time } : undefined,
        steps,
      });
      toast.success(`Workflow "${wf.name}" created`);
      navigate(`/workflows/${wf.id}`);
    } catch {
      toast.error('Failed to create workflow');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/workflows"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Create Workflow" description="Define a new automated workflow" />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Steps */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Workflow Steps</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start rounded-lg border p-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold mt-1">
                    {i + 1}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Step Name</Label>
                        <Input
                          value={step.name}
                          onChange={(e) => updateStep(i, 'name', e.target.value)}
                          placeholder="e.g., Pull LeadByte Data"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <select
                          value={step.type}
                          onChange={(e) => updateStep(i, 'type', e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                          {STEP_TYPES.map((t) => (
                            <option key={t} value={t}>{t.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Configuration</Label>
                      <Input
                        value={step.config}
                        onChange={(e) => updateStep(i, 'config', e.target.value)}
                        placeholder="Describe what this step does..."
                      />
                    </div>
                  </div>
                  {steps.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="size-8 mt-1" onClick={() => removeStep(i)}>
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={addStep}>
                <Plus className="size-4 mr-1.5" />
                Add Step
              </Button>
            </CardContent>
          </Card>

          {/* Settings */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Workflow Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Weekly Report" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this workflow do?"
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="trigger">Event Trigger</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                {type === 'scheduled' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <select
                        value={frequency}
                        onChange={(e) => {
                          setFrequency(e.target.value);
                          buildSchedule(e.target.value, day, time);
                        }}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    {frequency === 'weekly' && (
                      <div className="space-y-2">
                        <Label>Day</Label>
                        <select
                          value={day}
                          onChange={(e) => { setDay(e.target.value); buildSchedule(frequency, e.target.value, time); }}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {frequency === 'monthly' && (
                      <div className="space-y-2">
                        <Label>Day of Month</Label>
                        <select
                          value={day}
                          onChange={(e) => { setDay(e.target.value); buildSchedule(frequency, e.target.value, time); }}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={`${d}`}>{d === 1 ? '1st' : d === 2 ? '2nd' : d === 3 ? '3rd' : `${d}th`}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Time</Label>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => { setTime(e.target.value); buildSchedule(frequency, day, e.target.value); }}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{schedule || 'Select frequency and time'}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={createWorkflow.isPending}>
              {createWorkflow.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Create Workflow
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
