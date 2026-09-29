import { useState } from 'react';
import { AlertTriangle, Loader2, Plus, Send, Trash2, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  WEBHOOK_EVENTS, useCreateWebhook, useDeleteWebhook, useTestWebhook, useUpdateWebhook, useWebhookDeliveries, useWebhooks,
  type WebhookEndpoint, type WebhookEvent,
} from '@/lib/hooks/use-integrations-api';
import { CopyOnce } from './api-keys-settings';
import '@/creative-library.css';

// Settings → Webhooks (Sam feedback round 1, section 5 — plan phase 4).
// Owner only. Events are signed with the endpoint's secret
// (X-Stato-Signature); the secret is shown once when the endpoint is added.

export function webhookUrlError(raw: string): string | null {
  const t = raw.trim();
  if (!t) return 'Enter the URL that should receive the events.';
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:') return 'Use an https:// address — events carry client data.';
    return null;
  } catch {
    return 'That isn\'t a web address, e.g. https://example.com/stato-webhook.';
  }
}

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

export function WebhooksSettings() {
  const { data: hooks, isLoading, error } = useWebhooks();
  const create = useCreateWebhook();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<Set<WebhookEvent>>(new Set(['creative.added', 'creative.changed']));
  const [touched, setTouched] = useState(false);
  const [fresh, setFresh] = useState<{ url: string; secret: string } | null>(null);

  const urlErr = touched ? webhookUrlError(url) : null;
  const eventsErr = touched && events.size === 0 ? 'Choose at least one event.' : null;
  const toggle = (e: WebhookEvent) => setEvents((prev) => { const n = new Set(prev); if (n.has(e)) n.delete(e); else n.add(e); return n; });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (webhookUrlError(url) || events.size === 0) return;
    try {
      const res = await create.mutateAsync({ url: url.trim(), events: [...events] });
      setFresh({ url: res.endpoint?.url ?? url.trim(), secret: res.secret });
      setUrl(''); setTouched(false);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : "Couldn't add the webhook."} Nothing was saved.`);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card pad acard" style={{ display: 'grid', gap: 12 }}>
        <div>
          <h3 className="statto-title">Webhooks</h3>
          <p className="ac-sub" style={{ marginTop: 4 }}>Tell another system the moment a creative is added or changed, or a client is added. Each request is signed with the endpoint's secret in the <code>X-Stato-Signature</code> header.</p>
        </div>
        {fresh && (
          <div style={{ display: 'grid', gap: 8 }}>
            <strong>Copy the signing secret for {fresh.url} now — it won't be shown again.</strong>
            <CopyOnce label="signing secret" value={fresh.secret} />
            <div><button type="button" className="btn b-ghost b-sm" onClick={() => setFresh(null)}>I've saved it</button></div>
          </div>
        )}
        <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 12 }} aria-label="Add a webhook">
          <label style={{ display: 'grid', gap: 6, maxWidth: 520 }}>
            <span className="nc-label">Endpoint URL *</span>
            <input className="nc-input" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => setTouched(true)} placeholder="https://example.com/stato-webhook" aria-invalid={!!urlErr} aria-describedby={urlErr ? 'wh-url-err' : undefined} />
            {urlErr && <span id="wh-url-err" className="crl-err">{urlErr}</span>}
          </label>
          <fieldset className="crl-scopes" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="nc-label" style={{ marginBottom: 6 }}>Events *</legend>
            {WEBHOOK_EVENTS.map((ev) => (
              <label key={ev.value} className="crl-scope">
                <input type="checkbox" checked={events.has(ev.value)} onChange={() => toggle(ev.value)} />
                <span><strong>{ev.label}</strong> <span className="ac-sub mono" style={{ marginTop: 0 }}>{ev.value}</span></span>
              </label>
            ))}
            {eventsErr && <span className="crl-err">{eventsErr}</span>}
          </fieldset>
          <div><button type="submit" className="btn b-dark b-sm" disabled={create.isPending}>{create.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <Plus className="size-[15px]" />} Add webhook</button></div>
        </form>
      </div>

      <div className="card acard inv-card">
        {isLoading ? <div style={{ padding: 16 }}><Skeleton className="h-24" /></div>
        : error ? (
          <div className="ph-screen"><span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span><strong>Couldn't load webhooks</strong><p>{error instanceof Error ? error.message : 'Try refreshing the page.'}</p></div>
        ) : !hooks?.length ? (
          <div className="ph-screen"><span className="ph-screen-ic"><Webhook className="size-[26px]" /></span><strong>No webhooks yet</strong><p>Add an endpoint above to receive events.</p></div>
        ) : (
          <ul className="crl-list" aria-label="Webhooks">{hooks.map((h) => <WebhookRow key={h.id} hook={h} />)}</ul>
        )}
      </div>
    </div>
  );
}

function WebhookRow({ hook }: { hook: WebhookEndpoint }) {
  const [showDeliveries, setShowDeliveries] = useState(false);
  const update = useUpdateWebhook();
  const del = useDeleteWebhook();
  const test = useTestWebhook();
  const { data: deliveries, isLoading } = useWebhookDeliveries(showDeliveries ? hook.id : null);

  async function setActive(active: boolean) {
    try { await update.mutateAsync({ id: hook.id, active }); toast.success(active ? 'Webhook on.' : 'Webhook paused.'); }
    catch (err) { toast.error(`${err instanceof Error ? err.message : "Couldn't change it."} Nothing was changed.`); }
  }
  async function sendTest() {
    try {
      const d = await test.mutateAsync(hook.id);
      if (d?.ok) toast.success(`Test delivered${d.status ? ` (HTTP ${d.status})` : ''}.`);
      else toast.error(`Test sent, but ${d?.status ? `the endpoint answered HTTP ${d.status}` : d?.error ? d.error : 'the endpoint did not answer'}.`);
      setShowDeliveries(true);
    } catch (err) { toast.error(`${err instanceof Error ? err.message : "Couldn't send the test."}`); }
  }
  async function remove() {
    if (!window.confirm(`Delete the webhook to ${hook.url}? It stops receiving events straight away.`)) return;
    try { await del.mutateAsync(hook.id); toast.success('Webhook deleted.'); }
    catch (err) { toast.error(`${err instanceof Error ? err.message : "Couldn't delete it."} It still receives events.`); }
  }

  return (
    <li data-testid="webhook-row">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div className="cl-contact mono" style={{ overflowWrap: 'anywhere' }}>{hook.url}</div>
          <div className="crl-tags" style={{ marginTop: 4 }}>{hook.events.map((e) => <span key={e} className="cmp-vpill">{WEBHOOK_EVENTS.find((x) => x.value === e)?.label ?? e}</span>)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <Switch checked={hook.active} onCheckedChange={setActive} disabled={update.isPending} aria-label={`Webhook to ${hook.url} active`} />
            {hook.active ? 'On' : 'Paused'}
          </label>
          <button type="button" className="btn b-ghost b-sm" onClick={sendTest} disabled={test.isPending || !hook.active}>{test.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <Send className="size-[15px]" />} Send test</button>
          <button type="button" className="btn b-ghost b-sm" onClick={() => setShowDeliveries((v) => !v)} aria-expanded={showDeliveries}>Deliveries</button>
          <button type="button" className="btn b-ghost b-sm" onClick={remove} aria-label={`Delete webhook to ${hook.url}`}><Trash2 className="size-[15px]" /></button>
        </div>
      </div>
      {showDeliveries && (
        <div data-testid="webhook-deliveries">
          {isLoading ? <Skeleton className="h-12" /> : !deliveries?.length ? <p className="ac-sub">No deliveries yet.</p> : (
            <ul className="crl-files" style={{ marginTop: 4 }}>
              {deliveries.map((d) => {
                const ok = d.status === 'succeeded';
                return (
                  <li key={d.id} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5 }}>
                    <span className={`pill p-${ok ? 'pos' : d.nextAttemptAt ? 'warn' : 'neg'}`}>{d.responseCode ? `HTTP ${d.responseCode}` : d.status === 'pending' ? 'Pending' : 'No answer'}</span>
                    <span className="mono">{d.event}</span>
                    <span className="crl-sub">{fmt(d.deliveredAt ?? d.createdAt)} · {d.attempts} attempt{d.attempts === 1 ? '' : 's'}{!ok && d.nextAttemptAt ? ` · retrying ${fmt(d.nextAttemptAt)}` : ''}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
