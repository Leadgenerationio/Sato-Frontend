import { useState } from 'react';
import { useLbBuyers, useUpdateLbBuyer, type LbBuyer } from '@/lib/hooks/use-leadbyte';
import { EmptyState } from '@/components/shared/empty-state';
import { Building2, AlertTriangle } from 'lucide-react';

const STATUS_TABS = ['all', 'Active', 'Inactive'] as const;

function formatMoney(value?: number, currency = 'GBP') {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

// Yash (31-May-2026): LeadByte's /buyers API returns the same company
// twice when both a legacy numeric BID and the new slug BID exist for
// the same legal entity (e.g. "Trustmark Law" appears with BID "1" AND
// "TRUSTMARK-LAW"). Sam sees both rows on the admin page and reads it
// as a Stato bug. Dedupe by company name (case-insensitive), preferring
// the slug BID over the numeric one — slugs are LeadByte's current ID
// scheme; numerics are legacy and surface only on old buyer records.
function dedupeBuyers<T extends { company?: string | null; bid?: string | null }>(rows: T[]): T[] {
  const isNumericBid = (b: string | null | undefined): boolean => !!b && /^\d+$/.test(b);
  const byKey = new Map<string, T>();
  for (const r of rows) {
    const key = (r.company ?? '').trim().toLowerCase();
    if (!key) { byKey.set(`__${Math.random()}`, r); continue; }
    const existing = byKey.get(key);
    if (!existing) { byKey.set(key, r); continue; }
    // Prefer the slug BID over numeric (1, 2, etc.) when both exist.
    if (isNumericBid(existing.bid) && !isNumericBid(r.bid)) byKey.set(key, r);
  }
  return Array.from(byKey.values());
}

export function LeadByteBuyersPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>('all');
  const { data: rawBuyers, isLoading, error } = useLbBuyers(statusFilter === 'all' ? undefined : statusFilter);
  const buyers = rawBuyers ? dedupeBuyers(rawBuyers) : rawBuyers;
  const updateBuyer = useUpdateLbBuyer();

  const toggleStatus = (buyer: LbBuyer) => {
    if (!buyer.id) return;
    updateBuyer.mutate({
      id: buyer.id,
      update: { status: buyer.status === 'Active' ? 'Inactive' : 'Active' },
    });
  };

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">LeadByte Buyers</h1>
          <p className="ahead-sub">Buyers synced from LeadByte — status &amp; credit</p>
        </div>
      </div>

      <div className="inv-tabs" style={{ alignSelf: 'flex-start' }}>
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            className={'inv-tab' + (statusFilter === s ? ' on' : '')}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="card acard inv-card">
        {isLoading && (
          <div style={{ padding: '24px' }}>
            <p className="ac-sub">Loading buyers…</p>
          </div>
        )}
        {error && (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load buyers"
            description="LeadByte may be unreachable — contact your administrator if this persists."
          />
        )}
        {buyers && buyers.length === 0 && (
          <EmptyState
            icon={Building2}
            title={statusFilter === 'all' ? 'No buyers yet' : `No ${statusFilter.toLowerCase()} buyers`}
            description={
              statusFilter === 'all'
                ? 'Buyers sync from LeadByte. Add a buyer in LeadByte and it will appear here.'
                : 'No buyers match this filter. Try switching to "All".'
            }
          />
        )}
        {buyers && buyers.length > 0 && (
          <div className="table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>BID</th>
                  <th>Status</th>
                  <th className="r">Credit Amount</th>
                  <th className="r">Credit Balance</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((b) => (
                  <tr key={String(b.id ?? b.bid ?? b.company)}>
                    <td className="lb-company">{b.company}</td>
                    <td className="lb-bid">{b.bid ?? '—'}</td>
                    <td>
                      <span className={'lb-status' + (b.status === 'Active' ? ' on' : '')}>{b.status ?? 'Unknown'}</span>
                    </td>
                    <td className="r mono inv-num">{formatMoney(b.credit_amount)}</td>
                    <td className="r mono inv-total">{formatMoney(b.credit_balance)}</td>
                    <td className="r">
                      <button
                        className="btn b-ghost b-sm lb-act"
                        disabled={updateBuyer.isPending || !b.id}
                        onClick={() => toggleStatus(b)}
                      >
                        {b.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
