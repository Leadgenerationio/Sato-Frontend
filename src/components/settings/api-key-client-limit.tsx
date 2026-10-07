import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useClients } from '@/lib/hooks/use-clients';

// MCP spec §3, step 1h: an API key can be limited to some clients. Through
// the MCP endpoint such a key sees only those clients; another client's data
// answers "not found". A limited key cannot use the REST API (only whoami).

/** null = every client. Otherwise the chosen client ids (at least one). */
export type ClientLimit = string[] | null;

/** Client names for ids we already know, so chips never show a bare UUID when we can help it. */
export function useClientNames(): Map<string, string> {
  const { data } = useClients({ limit: 100, sort: 'company', dir: 'asc' });
  return useMemo(() => new Map((data?.clients ?? []).map((c) => [c.id, c.companyName])), [data]);
}

export function ClientLimitPicker({ value, onChange, idPrefix }: { value: ClientLimit; onChange: (v: ClientLimit) => void; idPrefix: string }) {
  const [search, setSearch] = useState('');
  const names = useClientNames();
  const [picked, setPicked] = useState<Map<string, string>>(() => new Map((value ?? []).map((id) => [id, names.get(id) ?? id])));
  const { data, isLoading } = useClients({ search: search.trim() || undefined, limit: 100, sort: 'company', dir: 'asc' });
  const limited = value !== null;
  const nameOf = (id: string) => names.get(id) ?? picked.get(id) ?? 'Client';

  const toggle = (id: string, name: string) => {
    const next = new Set(value ?? []);
    if (next.has(id)) next.delete(id); else { next.add(id); setPicked((p) => new Map(p).set(id, name)); }
    onChange([...next]);
  };

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
      <legend className="nc-label" style={{ marginBottom: 6 }}>Which clients it can see</legend>
      <label className="crl-scope">
        <input type="radio" name={`${idPrefix}-limit`} checked={!limited} onChange={() => onChange(null)} />
        <span><strong>All clients</strong> <span className="ac-sub" style={{ marginTop: 0 }}>— every client in this business</span></span>
      </label>
      <label className="crl-scope">
        <input type="radio" name={`${idPrefix}-limit`} checked={limited} onChange={() => onChange(value ?? [])} />
        <span><strong>Only these clients</strong> <span className="ac-sub" style={{ marginTop: 0 }}>— for an assistant that works for one client. Other clients look like they don't exist, and the key only works through the MCP server.</span></span>
      </label>
      {limited && (
        <div style={{ display: 'grid', gap: 8, paddingLeft: 24 }}>
          {value.length > 0 && (
            <div className="crl-tags" aria-label="Chosen clients">
              {value.map((id) => (
                <span key={id} className="cmp-vpill">
                  {nameOf(id)}
                  <button type="button" className="btn b-ghost b-sm" style={{ padding: '0 4px', minHeight: 0 }} onClick={() => toggle(id, nameOf(id))} aria-label={`Remove ${nameOf(id)}`}>
                    <X className="size-[12px]" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <label style={{ display: 'grid', gap: 6, maxWidth: 420 }}>
            <span className="sr-only">Search clients</span>
            <span style={{ position: 'relative' }}>
              <Search className="size-[15px]" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input className="nc-input" style={{ paddingLeft: 32 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients" aria-label="Search clients" />
            </span>
          </label>
          <div role="group" aria-label="Clients to choose from" style={{ display: 'grid', gap: 4, maxHeight: 220, overflowY: 'auto', maxWidth: 420 }}>
            {isLoading ? <span className="ac-sub">Loading clients…</span>
              : !data?.clients.length ? <span className="ac-sub">No clients match.</span>
              : data.clients.map((c) => (
                <label key={c.id} className="crl-scope">
                  <input type="checkbox" checked={value.includes(c.id)} onChange={() => toggle(c.id, c.companyName)} />
                  <span>{c.companyName}</span>
                </label>
              ))}
          </div>
          {value.length === 0 && <span className="crl-err">Choose at least one client, or pick "All clients".</span>}
        </div>
      )}
    </fieldset>
  );
}

/** One line for a key's row: "All clients" or the names it is limited to. `named` (from the API) wins over the page of clients. */
export function clientLimitLabel(ids: string[] | null | undefined, names: Map<string, string>, named?: Array<{ id: string; name: string }> | null): string {
  if (!ids) return 'All clients';
  if (named) names = new Map([...names, ...named.map((c) => [c.id, c.name] as [string, string])]);
  const known = ids.map((id) => names.get(id)).filter(Boolean) as string[];
  const unknown = ids.length - known.length;
  const list = known.slice(0, 3).join(', ');
  const more = known.length > 3 ? ` +${known.length - 3}` : '';
  const other = unknown > 0 ? `${known.length ? ' and ' : ''}${unknown} other client${unknown === 1 ? '' : 's'}` : '';
  return `Only ${list}${more}${other}`;
}
