import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, X, Loader2, ChevronDown, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateWorkflow } from '@/lib/hooks/use-workflows';

import { logError } from '../../lib/log';
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
    } catch (err) {
      logError('Operation failed', err);
      toast.error('Failed to create workflow');
    }
  }

  return (
    <div className="screen-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/workflows" className="nc-back" title="Back to workflows"><ArrowLeft className="size-5" /></Link>
          <div>
            <h1 className="ahead-title">Create Workflow</h1>
            <p className="ahead-sub">Define a new automated workflow</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="cw-layout">
          {/* Steps */}
          <div className="card pad acard">
            <h3 className="statto-title nc-h">Workflow Steps</h3>
            {steps.map((step, i) => (
              <div key={i} className="wf-step">
                <span className="wf-step-n">{i + 1}</span>
                <div className="wf-step-body">
                  {steps.length > 1 && (
                    <button type="button" className="wf-step-x" onClick={() => removeStep(i)} title="Remove step">
                      <X className="size-[15px]" />
                    </button>
                  )}
                  <div className="nc-grid2">
                    <div className="nc-field">
                      <label className="nc-label">Step Name</label>
                      <input
                        className="nc-input"
                        value={step.name}
                        onChange={(e) => updateStep(i, 'name', e.target.value)}
                        placeholder="e.g., Pull LeadByte Data"
                      />
                    </div>
                    <div className="nc-field">
                      <label className="nc-label">Type</label>
                      <div className="nc-select-wrap">
                        <select
                          className="nc-select"
                          value={step.type}
                          onChange={(e) => updateStep(i, 'type', e.target.value)}
                        >
                          {STEP_TYPES.map((t) => (
                            <option key={t} value={t}>{t.replace('_', ' ')}</option>
                          ))}
                        </select>
                        <ChevronDown className="lic size-[15px]" />
                      </div>
                    </div>
                  </div>
                  <div className="nc-field" style={{ marginBottom: 0 }}>
                    <label className="nc-label">Configuration</label>
                    <textarea
                      className="nc-textarea wf-config"
                      value={step.config}
                      onChange={(e) => updateStep(i, 'config', e.target.value)}
                      placeholder="Describe what this step does..."
                    />
                  </div>
                </div>
              </div>
            ))}

            <button type="button" className="btn b-ghost b-sm cw-addstep" onClick={addStep}>
              <Plus className="size-[15px]" />
              Add Step
            </button>
          </div>

          {/* Settings */}
          <div className="cw-side">
            <div className="card pad acard">
              <h3 className="statto-title nc-h">Settings</h3>
              <div className="nc-field">
                <label className="nc-label">Workflow Name</label>
                <input className="nc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Weekly Report" />
              </div>
              <div className="nc-field">
                <label className="nc-label">Description</label>
                <textarea
                  className="nc-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this workflow do?"
                  rows={3}
                />
              </div>
              <div className="nc-field">
                <label className="nc-label">Trigger Type</label>
                <div className="nc-select-wrap">
                  <select className="nc-select" value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="scheduled">Scheduled</option>
                    <option value="trigger">Event Trigger</option>
                    <option value="manual">Manual</option>
                  </select>
                  <ChevronDown className="lic size-[15px]" />
                </div>
              </div>
              {type === 'scheduled' && (
                <>
                  <div className="nc-field">
                    <label className="nc-label">Frequency</label>
                    <div className="nc-select-wrap">
                      <select
                        className="nc-select"
                        value={frequency}
                        onChange={(e) => {
                          setFrequency(e.target.value);
                          buildSchedule(e.target.value, day, time);
                        }}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <ChevronDown className="lic size-[15px]" />
                    </div>
                  </div>
                  {frequency === 'weekly' && (
                    <div className="nc-field">
                      <label className="nc-label">Day</label>
                      <div className="nc-select-wrap">
                        <select
                          className="nc-select"
                          value={day}
                          onChange={(e) => { setDay(e.target.value); buildSchedule(frequency, e.target.value, time); }}
                        >
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <ChevronDown className="lic size-[15px]" />
                      </div>
                    </div>
                  )}
                  {frequency === 'monthly' && (
                    <div className="nc-field">
                      <label className="nc-label">Day of Month</label>
                      <div className="nc-select-wrap">
                        <select
                          className="nc-select"
                          value={day}
                          onChange={(e) => { setDay(e.target.value); buildSchedule(frequency, e.target.value, time); }}
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={`${d}`}>{d === 1 ? '1st' : d === 2 ? '2nd' : d === 3 ? '3rd' : `${d}th`}</option>
                          ))}
                        </select>
                        <ChevronDown className="lic size-[15px]" />
                      </div>
                    </div>
                  )}
                  <div className="nc-field">
                    <label className="nc-label">Time</label>
                    <div className="ci-date">
                      <input
                        className="nc-input"
                        type="time"
                        value={time}
                        onChange={(e) => { setTime(e.target.value); buildSchedule(frequency, day, e.target.value); }}
                      />
                      <Clock className="lic size-4" />
                    </div>
                    <span className="nc-hint">{schedule || 'Select frequency and time'}</span>
                  </div>
                </>
              )}
            </div>

            <button type="submit" className="btn b-dark b-block cw-submit" disabled={createWorkflow.isPending}>
              {createWorkflow.isPending ? <Loader2 className="size-[15px] animate-spin" /> : null}
              Create Workflow
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
