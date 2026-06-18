import { Fragment, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortalLeads, usePortalDashboard } from '@/lib/hooks/use-portal';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import type { PortalLeadDay, PortalLeadsBySource } from '@/lib/hooks/use-portal';
import { platformLabel, formatMoney } from '@/lib/hooks/use-ad-spend';
import { Skeleton } from '@/components/ui/skeleton';

// Timezone-safe ISO date formatter (Sam jam-video #3, 29-May-2026) — the naive
// toISOString path broke the LeadByte preset match for BST users.
function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function isoDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return isoLocal(d);
}
function formatDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function firstOfMonth(year: number, month: number): string { return isoLocal(new Date(year, month, 1)); }
function lastOfMonth(year: number, month: number): string { return isoLocal(new Date(year, month + 1, 0)); }
function startOfWeek(): string {
  const now = new Date();
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
  return isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow));
}

const PRESETS: { label: string; from: () => string; to: () => string }[] = [
  { label: 'Today', from: () => isoDay(0), to: () => isoDay(0) },
  { label: 'Yesterday', from: () => isoDay(-1), to: () => isoDay(-1) },
  { label: 'This week', from: () => startOfWeek(), to: () => isoDay(0) },
  { label: 'This month', from: () => { const n = new Date(); return firstOfMonth(n.getFullYear(), n.getMonth()); }, to: () => isoDay(0) },
  { label: 'Last month', from: () => { const n = new Date(); return firstOfMonth(n.getFullYear(), n.getMonth() - 1); }, to: () => { const n = new Date(); return lastOfMonth(n.getFullYear(), n.getMonth() - 1); } },
  { label: 'YTD', from: () => `${new Date().getFullYear()}-01-01`, to: () => isoDay(0) },
];

interface DeliveryGroup {
  campaignId: string; campaignName: string; totalLeads: number; validLeads: number; invalidLeads: number;
  firstDate: string; lastDate: string; activeDays: number; days: PortalLeadDay[];
}

function groupByDelivery(leads: PortalLeadDay[]): DeliveryGroup[] {
  const map = new Map<string, DeliveryGroup>();
  for (const row of leads) {
    const existing = map.get(row.campaignId);
    if (existing) {
      existing.totalLeads += row.leadCount;
      existing.validLeads += row.validLeads;
      existing.invalidLeads += row.invalidLeads;
      if (row.date < existing.firstDate) existing.firstDate = row.date;
      if (row.date > existing.lastDate) existing.lastDate = row.date;
      existing.activeDays += 1;
      existing.days.push(row);
    } else {
      map.set(row.campaignId, {
        campaignId: row.campaignId, campaignName: row.campaignName, totalLeads: row.leadCount,
        validLeads: row.validLeads, invalidLeads: row.invalidLeads, firstDate: row.date, lastDate: row.date,
        activeDays: 1, days: [row],
      });
    }
  }
  return Array.from(map.values())
    .map((g) => ({ ...g, days: g.days.slice().sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.validLeads - a.validLeads);
}

function totalSpendByCurrency(rows: PortalLeadsBySource[]): Array<{ currency: string; total: number }> {
  const buckets = new Map<string, number>();
  for (const r of rows) buckets.set(r.currency, (buckets.get(r.currency) ?? 0) + r.spend);
  return Array.from(buckets.entries()).map(([currency, total]) => ({ currency, total }));
}

export function PortalLeadsPage() {
  usePageTitle('Stato — Leads');
  const DEFAULT_PRESET = PRESETS.find((p) => p.label === 'This month')!;
  const [from, setFrom] = useState<string>(DEFAULT_PRESET.from());
  const [to, setTo] = useState<string>(DEFAULT_PRESET.to());
  const [activePreset, setActivePreset] = useState<string | null>(DEFAULT_PRESET.label);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'by-campaign' | 'daily'>('by-campaign');
  const { data, isLoading } = usePortalLeads({ from, to });
  // Sam 2026-06-15: pay-per-lead clients must not see ad spend. Spend is zeroed
  // server-side; also hide the Ad spend column here so PPL clients don't see a
  // confusing £0.00 column. clientType comes from the (cached) dashboard query.
  const { data: dash } = usePortalDashboard();
  const showSpend = dash?.clientType === 'managed';
  const leads = data?.leads;
  const bySource = data?.bySource ?? [];
  const validLeadsByCampaign = data?.validLeadsByCampaign;

  const summary = useMemo(() => {
    const distinctDays = new Set((leads ?? []).map((d) => d.date)).size;
    // Total valid leads from the daily lead_deliveries rows — the reliable
    // per-day source (also drives Peak Day).
    const dailyTotal = (leads ?? []).reduce((s, d) => s + d.validLeads, 0);
    // The LeadByte by-source total matches the admin /reports view, so prefer it
    // WHEN it actually carries lead counts. But for YTD / custom ranges LeadByte's
    // supplier report returns spend without per-source valid leads, so the
    // by-source total is 0 — fall back to the daily total then, otherwise Total
    // Leads showed 0 while Peak Day showed real data.
    const bySourceTotal = bySource.reduce((s, r) => s + r.leads, 0);
    const total = bySourceTotal > 0 ? bySourceTotal : dailyTotal;
    const peak = (leads ?? []).reduce((m, d) => (d.validLeads > m ? d.validLeads : m), 0);
    return { total, avg: distinctDays > 0 ? Math.round(total / distinctDays) : 0, peak };
  }, [leads, bySource]);

  const chartData = useMemo(
    () => (leads ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ date: formatDayShort(d.date), leads: d.validLeads })),
    [leads],
  );

  const deliveries = useMemo(() => {
    const groups = groupByDelivery(leads ?? []);
    if (!validLeadsByCampaign) return groups;
    return groups
      .map((g) => { const o = validLeadsByCampaign[g.campaignId]; return o != null ? { ...g, validLeads: o } : g; })
      .sort((a, b) => b.validLeads - a.validLeads);
  }, [leads, validLeadsByCampaign]);

  const toggleExpanded = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const applyPreset = (p: typeof PRESETS[number]) => { setFrom(p.from()); setTo(p.to()); setActivePreset(p.label); };

  return (
    <div className="screen">
      {/* Date range */}
      <div className="card pad">
        <div className="txn-head" style={{ marginBottom: 14 }}>
          <div><h3 className="statto-title">Date range</h3><p className="lc-sub">Pick a preset or set a custom period</p></div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <div className="acct-field"><label className="acct-l" htmlFor="from-date">From</label>
            <input id="from-date" className="acct-input" type="date" value={from} max={to} style={{ width: 160 }}
              onChange={(e) => { setFrom(e.target.value); setActivePreset(null); }} /></div>
          <div className="acct-field"><label className="acct-l" htmlFor="to-date">To</label>
            <input id="to-date" className="acct-input" type="date" value={to} min={from} max={isoDay(0)} style={{ width: 160 }}
              onChange={(e) => { setTo(e.target.value); setActivePreset(null); }} /></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.map((p) => (
              <button key={p.label} className={'btn b-sm ' + (activePreset === p.label ? 'b-dark' : 'b-ghost')} onClick={() => applyPreset(p)}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <><Skeleton className="h-[120px] rounded-3xl" /><Skeleton className="h-72 rounded-3xl" /></>
      ) : (
        <>
          <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[{ v: summary.total, l: 'Total Leads' }, { v: summary.avg, l: 'Avg / Day' }, { v: summary.peak, l: 'Peak Day' }].map((s) => (
              <div className="pstat" key={s.l} style={{ minHeight: 132 }}>
                <div className="pstat-val mono">{s.v.toLocaleString()}</div><div className="pstat-lab">{s.l}</div>
              </div>
            ))}
          </div>

          {/* By Source is the ad-spend breakdown — hide the whole card for PPL
              clients (showSpend off), not just the spend column. */}
          {showSpend && bySource.length > 0 && (
            <div className="card pad">
              <h3 className="statto-title" style={{ marginBottom: 4 }}>By Source</h3>
              <p className="lc-sub" style={{ marginBottom: 16 }}>Valid leads from LeadByte and ad spend from Catchr — same numbers as the admin /reports campaign view.</p>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>Source</th><th style={{ textAlign: 'right' }}>Leads</th><th style={{ textAlign: 'right' }}>Ad spend</th></tr></thead>
                  <tbody>
                    {bySource.map((row) => (
                      <tr key={`${row.platform}-${row.currency}`}>
                        <td style={{ fontWeight: 600 }}>{platformLabel(row.platform)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{row.leads.toLocaleString()}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(row.spend, row.currency)}</td>
                      </tr>
                    ))}
                    {totalSpendByCurrency(bySource).map(({ currency, total }, idx) => (
                      <tr key={`total-${currency}`} style={{ background: 'var(--gray-50)' }}>
                        <td style={{ fontWeight: 700 }}>Total</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{idx === 0 ? summary.total.toLocaleString() : ''}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(total, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card pad">
            <h3 className="statto-title" style={{ marginBottom: 4 }}>Daily Volume</h3>
            <p className="lc-sub" style={{ marginBottom: 16 }}>Leads delivered per day</p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#84D451" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#84D451" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7B7B7B' }} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis width={34} tick={{ fontSize: 11, fill: '#7B7B7B' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="leads" stroke="#66B534" strokeWidth={2.5} fill="url(#leadArea)" name="Leads" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* By Campaign / Daily tabs */}
          <div className="card pad">
            <div className="txn-head" style={{ marginBottom: 14 }}>
              <h3 className="statto-title">{tab === 'by-campaign' ? 'By Campaign' : 'Daily Breakdown'}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={'btn b-sm ' + (tab === 'by-campaign' ? 'b-dark' : 'b-ghost')} onClick={() => setTab('by-campaign')}>By Campaign</button>
                <button className={'btn b-sm ' + (tab === 'daily' ? 'b-dark' : 'b-ghost')} onClick={() => setTab('daily')}>Daily</button>
              </div>
            </div>

            <div className="table-scroll">
              {tab === 'by-campaign' ? (
                <table>
                  <thead><tr><th style={{ width: 28 }} /><th>Campaign</th><th>Date Range</th><th style={{ textAlign: 'right' }}>Days</th><th style={{ textAlign: 'right' }}>Leads</th></tr></thead>
                  <tbody>
                    {deliveries.length > 0 ? deliveries.map((d) => {
                      const isExpanded = expanded.has(d.campaignId);
                      return (
                        <Fragment key={d.campaignId}>
                          <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpanded(d.campaignId)}>
                            <td><ChevronRight className="size-4" style={{ color: 'var(--fg3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }} /></td>
                            <td style={{ fontWeight: 600 }}>{d.campaignName}</td>
                            <td style={{ color: 'var(--fg2)' }}>{d.firstDate === d.lastDate ? formatDayShort(d.firstDate) : `${formatDayShort(d.firstDate)} – ${formatDayShort(d.lastDate)}`}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--fg2)' }}>{d.activeDays}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{d.validLeads}</td>
                          </tr>
                          {isExpanded && (
                            <tr><td colSpan={5} style={{ background: 'var(--gray-50)', padding: 0 }}>
                              <div style={{ padding: '8px 18px' }}>
                                <table>
                                  <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Valid</th><th style={{ textAlign: 'right' }}>Invalid</th><th style={{ textAlign: 'right' }}>Leads</th></tr></thead>
                                  <tbody>
                                    {d.days.map((day, i) => (
                                      <tr key={i}>
                                        <td>{formatDayShort(day.date)}</td>
                                        <td className="mono" style={{ textAlign: 'right', color: 'var(--fg2)' }}>{day.validLeads}</td>
                                        <td className="mono" style={{ textAlign: 'right', color: 'var(--fg2)' }}>{day.invalidLeads}</td>
                                        <td className="mono" style={{ textAlign: 'right' }}>{day.leadCount}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td></tr>
                          )}
                        </Fragment>
                      );
                    }) : (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--fg2)', padding: 32 }}>No leads in this date range.</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead><tr><th>Date</th><th>Campaign</th><th style={{ textAlign: 'right' }}>Leads</th></tr></thead>
                  <tbody>
                    {leads && leads.length > 0 ? leads.map((d, i) => (
                      <tr key={i}>
                        <td>{formatDayShort(d.date)}</td>
                        <td style={{ color: 'var(--fg2)' }}>{d.campaignName}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{d.validLeads}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--fg2)', padding: 32 }}>No leads in this date range.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
