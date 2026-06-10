import { useState } from 'react';
import { useLbDeliveries, type LbDeliveryCaps } from '@/lib/hooks/use-leadbyte';
import { EmptyState } from '@/components/shared/empty-state';
import { Truck, AlertTriangle } from 'lucide-react';

const STATUS_TABS = ['all', 'Active', 'Inactive', 'Saved'] as const;

/**
 * Render a delivery's per-period caps in the most compact form possible.
 * LeadByte allows day / week / month / total — any subset may be set, and a
 * delivery with no caps configured means "unlimited" (a real LeadByte state,
 * Sam confirmed in the 2026-05-15 Loom that some lead flows have no ceiling).
 *
 * Sam specifically asked for caps to be surfaced ("if the cap was 1,000,
 * it shows leads delivered out of 1,000"). v1 shows the configured limits;
 * the delivered-against-cap join lives in a follow-up so we don't block
 * shipping the data point he actually named.
 */
export function formatCaps(caps: LbDeliveryCaps | undefined): { primary: string; tooltip: string } {
  if (!caps) return { primary: 'No cap', tooltip: 'No delivery cap configured (unlimited)' };
  const parts: string[] = [];
  // Pin to en-GB so 1,000,000 renders the same for Sam (UK) regardless of
  // the browser's locale. Without this, an en-IN browser would render the
  // Indian grouping (10,00,000) and an en-US would render 1,000,000.
  const fmt = (n: number) => n.toLocaleString('en-GB');
  if (caps.day != null) parts.push(`${fmt(caps.day)}/day`);
  if (caps.week != null) parts.push(`${fmt(caps.week)}/week`);
  if (caps.month != null) parts.push(`${fmt(caps.month)}/month`);
  if (caps.total != null) parts.push(`${fmt(caps.total)} total`);
  if (parts.length === 0) return { primary: 'No cap', tooltip: 'No delivery cap configured (unlimited)' };
  // In the table cell show the tightest single window first (day > week >
  // month > total) since that's the one Sam tracks most actively. Hover
  // shows the full set.
  return { primary: parts[0], tooltip: parts.join(' · ') };
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card lbd-stat">
      <span className="lbd-stat-k">{label}</span>
      <span className="lbd-stat-v mono">{value}</span>
    </div>
  );
}

export function LeadByteDeliveriesPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>('all');
  const status = statusFilter === 'all' ? undefined : statusFilter;
  const { data: deliveries, isLoading, error } = useLbDeliveries(status);
  // Always pull the full list for the count summary so the stat cards don't
  // change when the user filters the table.
  const { data: allDeliveries } = useLbDeliveries();
  const totalCount = allDeliveries?.length ?? 0;
  const activeCount = allDeliveries?.filter((d) => d.status === 'Active').length ?? 0;
  const inactiveCount = allDeliveries?.filter((d) => d.status === 'Inactive').length ?? 0;
  const savedCount = allDeliveries?.filter((d) => d.status === 'Saved').length ?? 0;

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">LeadByte Deliveries</h1>
          <p className="ahead-sub">
            Each row is a delivery rule — where leads from a campaign are routed (buyer, email, SMS, direct post). Counts below show how many rules are configured, not lead volume.
          </p>
        </div>
      </div>

      <div className="lbd-stats">
        <StatCard label="TOTAL" value={totalCount} />
        <StatCard label="ACTIVE" value={activeCount} />
        <StatCard label="INACTIVE" value={inactiveCount} />
        <StatCard label="SAVED" value={savedCount} />
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
            <p className="ac-sub">Loading deliveries…</p>
          </div>
        )}
        {error && (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load deliveries"
            description="LeadByte may be unreachable. Try again in a moment."
          />
        )}
        {deliveries && deliveries.length === 0 && (
          <EmptyState
            icon={Truck}
            title={statusFilter === 'all' ? 'No deliveries yet' : `No ${statusFilter.toLowerCase()} deliveries`}
            description={
              statusFilter === 'all'
                ? 'Delivery rules sync from LeadByte. Configure routing in LeadByte to populate this list.'
                : 'No deliveries match this filter. Try switching to "All".'
            }
          />
        )}
        {deliveries && deliveries.length > 0 && (
          <div className="table-scroll">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Campaign</th>
                  <th>Type</th>
                  <th>Buyer</th>
                  <th>Caps</th>
                  <th className="r">Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => {
                  const capsView = formatCaps(d.caps);
                  return (
                    <tr key={String(d.id)}>
                      <td className="lb-bid lbd-ref">{d.reference ?? d.id}</td>
                      <td className="cmp-client">{d.campaign?.name ?? '—'}</td>
                      <td className="cmp-client">{d.deliver_to ?? '—'}</td>
                      <td className="lbd-buyer">
                        {d.buyer?.name ?? '—'} {d.buyer?.bid && <span className="lb-bid">({d.buyer.bid})</span>}
                      </td>
                      <td className={'lbd-cap' + (d.caps ? ' mono' : ' muted')} title={capsView.tooltip}>
                        {capsView.primary}
                      </td>
                      <td className="r">
                        <span className={'lb-status' + (d.status === 'Active' ? ' on' : '')}>{d.status ?? 'Unknown'}</span>
                      </td>
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
