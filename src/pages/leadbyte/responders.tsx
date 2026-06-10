import { useLbResponders } from '@/lib/hooks/use-leadbyte';
import { EmptyState } from '@/components/shared/empty-state';
import { Send, AlertTriangle } from 'lucide-react';

function formatMoney(value?: number, currency = 'GBP') {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

export function LeadByteRespondersPage() {
  const { data: responders, isLoading, error } = useLbResponders();

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">LeadByte Responders</h1>
          <p className="ahead-sub">Email/SMS responder configurations + push performance</p>
        </div>
      </div>

      <div className="card acard inv-card">
        {isLoading && (
          <div style={{ padding: '24px' }}>
            <p className="ac-sub">Loading responders…</p>
          </div>
        )}
        {error && (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load responders"
            description="LeadByte may be unreachable. Try again in a moment."
          />
        )}
        {responders && responders.length === 0 && (
          <EmptyState
            icon={Send}
            title="No responders configured"
            description="Email and SMS responders sync from LeadByte. Configure responders in LeadByte to track push performance here."
          />
        )}
        {responders && responders.length > 0 && (
          <div className="table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th className="r">Pushes</th>
                  <th className="r">Revenue</th>
                  <th className="r">Profit</th>
                </tr>
              </thead>
              <tbody>
                {responders.map((r) => {
                  const totalRevenue = (r.pushes ?? []).reduce((acc, p) => acc + (p.revenue ?? 0), 0);
                  const totalProfit = (r.pushes ?? []).reduce((acc, p) => acc + (p.profit ?? 0), 0);
                  return (
                    <tr key={String(r.id)}>
                      <td className="lb-bid lbd-ref">{r.reference ?? r.id}</td>
                      <td className="cmp-client">{r.campaign?.name ?? '—'}</td>
                      <td>
                        <span className={'lb-status' + (r.status === 'Active' ? ' on' : '')}>{r.status ?? 'Unknown'}</span>
                      </td>
                      <td className="r mono inv-num">{r.pushes?.length ?? 0}</td>
                      <td className="r mono inv-total">{formatMoney(totalRevenue)}</td>
                      <td className={'r mono ' + (totalProfit >= 0 ? 'rpt-pos' : 'rpt-neg')}>{formatMoney(totalProfit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
