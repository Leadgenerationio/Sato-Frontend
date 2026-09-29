import { useState } from 'react';
import { AlertTriangle, BookOpen, Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/env';
import {
  API_KEY_SCOPES, apiDocsUrl, useApiKeys, useCreateApiKey, useRevokeApiKey, type ApiKey, type ApiKeyScope,
} from '@/lib/hooks/use-integrations-api';
import '@/creative-library.css';

// Settings → API keys (Sam feedback round 1, section 5 — plan phase 2).
// Owner only. A key is shown once; only its hash is stored. Every use is
// logged per key (usage30d / lastUsedAt).

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';
}

export function CopyOnce({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { toast.error("Couldn't copy — select the text and copy it by hand."); }
  };
  return (
    <div className="crl-secret" role="status" data-testid="shown-once-secret">
      <code>{value}</code>
      <button type="button" className="btn b-ghost b-sm" onClick={copy} aria-label={`Copy ${label}`}>
        {copied ? <Check className="size-[15px]" /> : <Copy className="size-[15px]" />} {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function ApiKeysSettings() {
  const { data: keys, isLoading, error } = useApiKeys();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<Set<ApiKeyScope>>(new Set(['clients:read', 'creatives:write']));
  const [fresh, setFresh] = useState<{ name: string; key: string } | null>(null);
  const [touched, setTouched] = useState(false);

  const nameErr = touched && !name.trim() ? 'Give the key a name, e.g. "Meta uploader".' : null;
  const scopeErr = touched && scopes.size === 0 ? 'Choose at least one permission.' : null;

  const toggleScope = (s: ApiKeyScope) => setScopes((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || scopes.size === 0) return;
    try {
      const res = await create.mutateAsync({ name: name.trim(), scopes: [...scopes] });
      setFresh({ name: res.apiKey?.name ?? name.trim(), key: res.key });
      setName(''); setTouched(false);
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : "Couldn't create the key."} No key was created.`);
    }
  }

  async function doRevoke(k: ApiKey) {
    if (!window.confirm(`Revoke "${k.name}"? Anything using it stops working straight away. This can't be undone.`)) return;
    try { await revoke.mutateAsync(k.id); toast.success(`"${k.name}" revoked.`); }
    catch (err) { toast.error(`${err instanceof Error ? err.message : "Couldn't revoke the key."} It still works.`); }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card pad acard" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h3 className="statto-title">API keys</h3>
            <p className="ac-sub" style={{ marginTop: 4 }}>Let another system (or an AI assistant through the MCP server) file creatives under the right client. Send the key in the <code>X-API-Key</code> header.</p>
          </div>
          <a href={apiDocsUrl(API_URL)} target="_blank" rel="noreferrer"><button type="button" className="btn b-ghost b-sm"><BookOpen className="size-[15px]" /> API docs</button></a>
        </div>

        {fresh && (
          <div style={{ display: 'grid', gap: 8 }}>
            <strong>Copy the key for "{fresh.name}" now — it won't be shown again.</strong>
            <CopyOnce label="API key" value={fresh.key} />
            <div><button type="button" className="btn b-ghost b-sm" onClick={() => setFresh(null)}>I've saved it</button></div>
          </div>
        )}

        <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 12 }} aria-label="Create an API key">
          <label style={{ display: 'grid', gap: 6, maxWidth: 420 }}>
            <span className="nc-label">Key name *</span>
            <input className="nc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Meta uploader" aria-invalid={!!nameErr} aria-describedby={nameErr ? 'ak-name-err' : undefined} />
            {nameErr && <span id="ak-name-err" className="crl-err">{nameErr}</span>}
          </label>
          <fieldset className="crl-scopes" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="nc-label" style={{ marginBottom: 6 }}>What it can do *</legend>
            {API_KEY_SCOPES.map((s) => (
              <label key={s.value} className="crl-scope">
                <input type="checkbox" checked={scopes.has(s.value)} onChange={() => toggleScope(s.value)} />
                <span><strong>{s.label}</strong> <span className="ac-sub" style={{ marginTop: 0 }}>— {s.hint}</span></span>
              </label>
            ))}
            {scopeErr && <span className="crl-err">{scopeErr}</span>}
          </fieldset>
          <div><button type="submit" className="btn b-dark b-sm" disabled={create.isPending}>{create.isPending ? <Loader2 className="size-[15px] animate-spin" /> : <Plus className="size-[15px]" />} Create key</button></div>
        </form>
      </div>

      <div className="card acard inv-card">
        {isLoading ? <div style={{ padding: 16 }}><Skeleton className="h-24" /></div>
        : error ? (
          <div className="ph-screen"><span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span><strong>Couldn't load API keys</strong><p>{error instanceof Error ? error.message : 'Try refreshing the page.'}</p></div>
        ) : !keys?.length ? (
          <div className="ph-screen"><span className="ph-screen-ic"><KeyRound className="size-[26px]" /></span><strong>No API keys yet</strong><p>Create one above when a system needs to send creatives in.</p></div>
        ) : (
          <ul className="crl-list" aria-label="API keys">
            {keys.map((k) => (
              <li key={k.id} data-testid="api-key-row" style={k.revokedAt ? { opacity: 0.6 } : undefined}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="cl-contact">{k.name} {k.revokedAt && <span className="pill p-gray">Revoked</span>}</div>
                    <div className="cl-email mono">{k.prefix}… · created {fmt(k.createdAt)}</div>
                  </div>
                  {!k.revokedAt && (
                    <button type="button" className="btn b-ghost b-sm" onClick={() => doRevoke(k)} disabled={revoke.isPending} aria-label={`Revoke ${k.name}`}>
                      <Trash2 className="size-[15px]" /> Revoke
                    </button>
                  )}
                </div>
                <div className="crl-tags">{k.scopes.map((s) => <span key={s} className="cmp-vpill">{API_KEY_SCOPES.find((x) => x.value === s)?.label ?? s}</span>)}</div>
                <div className="crl-sub">Last used {fmt(k.lastUsedAt)} · {k.usage30d} call{k.usage30d === 1 ? '' : 's'} in the last 30 days{k.revokedAt ? ` · revoked ${fmt(k.revokedAt)}` : ''}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
