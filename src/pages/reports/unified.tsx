import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Check, ExternalLink, Info, Sparkles, TrendingUp } from 'lucide-react';

// Shared explanation for the cost-concept column tooltips. "Spend" on this
// report is Catchr ad-spend (what Sam pays Meta / Google / TikTok / Taboola
// for the media buy). It is NOT the LeadByte supplier payout (what Sam pays
// third-party lead-sellers — that's £0 on most rows because the campaigns
// are direct-traffic). LeadReports.io exposes the LB-payout view, which is
// why its Cost/Margin numbers are smaller than Stato's. Both are correct
// for what they measure; this tooltip is the disambiguation.
const SPEND_HINT =
  'Catchr ad spend — what you pay Meta / Google / TikTok / Taboola for the media buy. Does NOT include LeadByte supplier payouts (different cost concept).';
const MARGIN_HINT =
  'Margin = (Revenue − Spend) / Revenue. Spend uses Catchr ad spend only — so the % reflects ad-cost efficiency, not LeadByte supplier payouts.';
import {
  useUnifiedReport,
  WINDOW_OPTIONS,
  type DeliveryWindow,
  type UnifiedReportRow,
} from '@/lib/hooks/use-reports';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { formatCurrency } from '@/lib/currency';

// Sam Loom #72-85 — the unified leadreports.io-style report. One row per
// (campaign × supplier). Sum of row revenue = campaign revenue. Filters:
// date window + supplier (dropdown) + campaign (dropdown). Sam, 2026-05-20
// asked for explicit dropdowns instead of free-text inputs so the picker
// always shows the exact values the report contains. We fetch the window
// unfiltered, derive option lists from the rows, and apply supplier +
// campaign filters client-side so the totals strip stays consistent with
// the visible table.

// Finding #12: UnifiedReportTotals/rows have no currency field — this report
// is GBP-denominated, so GBP is the documented default. All money goes through
// the guarded formatCurrency (src/lib/currency.ts), which falls back gracefully
// rather than throwing a RangeError on a bad code (Finding #15).

// Tile-friendly currency: integer pounds below 1M, compact ("£4.2M") at/above.
// The full precise value goes into the tooltip on the tile so nothing is lost.
// Exported for unit tests — the 1M threshold is a magic number worth locking in.
// Guarded against malformed currency codes (Finding #15) so a tile can't crash.
export function formatTileCurrency(value: number, currency = 'GBP') {
  const opts: Intl.NumberFormatOptions = Math.abs(value) >= 1_000_000
    ? { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }
    : { style: 'currency', currency, maximumFractionDigits: 0 };
  try {
    return new Intl.NumberFormat('en-GB', opts).format(value);
  } catch {
    try {
      return new Intl.NumberFormat('en-GB', { ...opts, currency: 'GBP' }).format(value);
    } catch {
      return Math.round(value).toString();
    }
  }
}

export function formatTileNumber(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  return value.toLocaleString();
}

// Map a profit/margin number to the design's pos / neg / zero colour class.
const pmCls = (value: number) => (value > 0 ? 'rpt-pos' : value < 0 ? 'rpt-neg' : 'rpt-zero');
// Margin keeps the original three-tier semantics (healthy ≥50 / review ≥30 /
// loss). pos & neg map to the design colour classes; the middle "review" band
// uses the Statto warning token inline since the report stylesheet has no
// amber margin class. Returns { className, style } to spread onto the <td>.
function marginProps(margin: number): { className: string; style?: React.CSSProperties } {
  if (margin >= 50) return { className: 'r mono rpt-pos' };
  if (margin >= 30) return { className: 'r mono', style: { color: 'var(--warning)', fontWeight: 600 } };
  if (margin === 0) return { className: 'r mono rpt-zero' };
  return { className: 'r mono rpt-neg' };
}

export function UnifiedReportPage() {
  // Renamed from `window` to avoid shadowing the DOM global. The prior
  // name worked thanks to React function scoping, but `window.replace(...)`
  // in JSX (lines below) reads ambiguously, lint-flags as a global shadow,
  // and breaks under stricter no-shadow/no-redeclare configs (OCT-44).
  const [reportWindow, setReportWindow] = useState<DeliveryWindow>('this_month');
  const [supplier, setSupplier] = useState('');
  const [campaign, setCampaign] = useState('');

  // Fetch unfiltered for the window — supplier + campaign filters now apply
  // client-side so the option lists below stay stable as you pick (otherwise
  // selecting "facebook" would collapse the supplier dropdown to just
  // "facebook" on the next render).
  const { data, isLoading, error, refetch } = useUnifiedReport({ window: reportWindow });

  const allRows = data?.rows ?? [];

  // Option lists drawn from the full window — sorted alphabetically so the
  // dropdown order doesn't shuffle as data refreshes. Suppliers de-duped
  // case-insensitively because LeadByte returns inconsistent casing.
  const supplierOptions = useMemo(() => {
    const seen = new Map<string, string>(); // lowercased → display
    for (const r of allRows) {
      if (!r.supplier) continue;
      const key = r.supplier.toLowerCase();
      if (!seen.has(key)) seen.set(key, r.supplier);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const campaignOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of allRows) if (r.campaignName) seen.add(r.campaignName);
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  const rows = useMemo(() => {
    if (!supplier && !campaign) return allRows;
    const sLower = supplier.toLowerCase();
    return allRows.filter((r) => {
      if (supplier && r.supplier.toLowerCase() !== sLower) return false;
      if (campaign && r.campaignName !== campaign) return false;
      return true;
    });
  }, [allRows, supplier, campaign]);

  // Recompute totals from the filtered rows so the totals strip always
  // matches the visible table. When no filter is applied this matches the
  // server totals exactly (same row set).
  const totals = useMemo(() => {
    if (rows.length === 0) return undefined;
    const leads = rows.reduce((s, r) => s + r.leads, 0);
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const profit = revenue - spend;
    const margin = revenue > 0 ? Math.round(((revenue - spend) / revenue) * 1000) / 10 : 0;
    return { leads, spend, revenue, profit, margin };
  }, [rows]);

  // Group rows by campaign for the breakdown view at the bottom — Sam's
  // mental model is "Solar Panels with 3 suppliers, here are the per-supplier
  // numbers". The main table shows the flat per-row view (leadreports.io
  // shape); this gives the at-a-glance per-vertical aggregate.
  const byCampaign = useMemo(() => {
    const map = new Map<string, { name: string; vertical: string; rows: UnifiedReportRow[] }>();
    for (const r of rows) {
      const existing = map.get(r.campaignName);
      if (existing) existing.rows.push(r);
      else map.set(r.campaignName, { name: r.campaignName, vertical: r.vertical, rows: [r] });
    }
    return Array.from(map.values()).sort((a, b) => {
      const aRev = a.rows.reduce((s, r) => s + r.revenue, 0);
      const bRev = b.rows.reduce((s, r) => s + r.revenue, 0);
      return bRev - aRev;
    });
  }, [rows]);

  // Sam (2026-05-15 meeting #10) — "By source · profitability". Roll the
  // per-(campaign × supplier) rows up to one row per platform (Facebook,
  // Google Ads, TikTok, Taboola, Direct, Bing, etc) — same shape Sam sees on
  // LeadReports.io. We aggregate CLIENT-SIDE off the already-filtered `rows`
  // so the table tracks the supplier + campaign dropdowns above; backend
  // sends a `byPlatform` array too but we ignore it here so a filter never
  // produces a roll-up that disagrees with the visible main-table totals.
  const bySource = useMemo(() => {
    const map = new Map<string, { platform: string; catchrUrl: string | null; leads: number; spend: number; revenue: number }>();
    for (const r of rows) {
      const key = r.supplierPlatform || 'Unknown';
      const existing = map.get(key);
      if (existing) {
        existing.leads += r.leads;
        existing.spend += r.spend;
        existing.revenue += r.revenue;
        // First-write-wins on the Catchr URL — matches the BE convention.
        if (!existing.catchrUrl && r.catchrUrl) existing.catchrUrl = r.catchrUrl;
      } else {
        map.set(key, {
          platform: key,
          catchrUrl: r.catchrUrl,
          leads: r.leads,
          spend: r.spend,
          revenue: r.revenue,
        });
      }
    }
    return Array.from(map.values())
      .map((b) => {
        const profit = b.revenue - b.spend;
        const margin = b.revenue > 0 ? Math.round(((b.revenue - b.spend) / b.revenue) * 1000) / 10 : 0;
        const cpl = b.leads > 0 ? Math.round((b.spend / b.leads) * 100) / 100 : 0;
        return { ...b, profit, margin, cpl };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Reports</h1>
          <p className="ahead-sub">
            One unified view — revenue from LeadByte, cost from Catchr ad spend (NOT LeadByte supplier payout), profit + margin per supplier.
          </p>
        </div>
        <span className="rpt-new"><Sparkles className="size-[13px]" /> New</span>
      </div>

      {/* Window selector */}
      <div className="rpt-tabs">
        {WINDOW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={'rpt-tab' + (reportWindow === opt.value ? ' on' : '')}
            onClick={() => setReportWindow(opt.value as DeliveryWindow)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filters — dropdowns drawn from the unfiltered window so the option
          lists stay stable while picking. Both default to "All". */}
      <div className="rpt-filters">
        <FilterSelect
          value={supplier}
          onChange={setSupplier}
          allLabel={`All suppliers${supplierOptions.length ? ` (${supplierOptions.length})` : ''}`}
          options={supplierOptions}
          disabled={isLoading || supplierOptions.length === 0}
        />
        <FilterSelect
          value={campaign}
          onChange={setCampaign}
          allLabel={`All campaigns${campaignOptions.length ? ` (${campaignOptions.length})` : ''}`}
          options={campaignOptions}
          disabled={isLoading || campaignOptions.length === 0}
        />
      </div>

      {/* Totals strip */}
      {totals && (
        <div className="rpt-kpi-row">
          <TotalCard
            label="Leads"
            value={formatTileNumber(totals.leads)}
            fullValue={totals.leads.toLocaleString()}
          />
          <TotalCard
            label="Spend"
            value={formatTileCurrency(totals.spend)}
            fullValue={formatCurrency(totals.spend)}
            hint={SPEND_HINT}
            neg
          />
          <TotalCard
            label="Revenue"
            value={formatTileCurrency(totals.revenue)}
            fullValue={formatCurrency(totals.revenue)}
          />
          <TotalCard
            label="Profit"
            value={formatTileCurrency(totals.profit)}
            fullValue={formatCurrency(totals.profit)}
            neg={totals.profit < 0}
            hint={MARGIN_HINT}
          />
          <TotalCard
            label="Margin"
            value={`${totals.margin}%`}
            neg={totals.margin < 30}
            hint={MARGIN_HINT}
          />
        </div>
      )}

      {/* Main table */}
      <div className="card pad acard">
        <h3 className="statto-title">
          {rows.length === 0 ? 'No matching rows' : `${rows.length} row${rows.length === 1 ? '' : 's'}`}
        </h3>
        <p className="ac-sub" style={{ marginTop: 4, marginBottom: 18 }}>
          One row per (campaign × supplier). Revenue allocated by lead share — sum across
          suppliers equals each campaign's total.
        </p>
        {isLoading ? (
          <p className="ac-sub">Loading report…</p>
        ) : error ? (
          <ErrorState title="Couldn't load report" error={error} onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title={supplier || campaign ? 'No matches for these filters' : 'No data for this window'}
            description={
              supplier || campaign
                ? 'Try widening or clearing the supplier / campaign filters.'
                : 'LeadByte returned nothing for this window. Try a wider window or wait for the next hourly sync.'
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="inv-table rpt-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Vertical</th>
                  <th>Client</th>
                  <th>Supplier</th>
                  <th>Catchr NCP</th>
                  <th className="r">Leads</th>
                  <th className="r">
                    <span className="inline-flex items-center justify-end gap-1">
                      Spend
                      <span title={SPEND_HINT} aria-label={SPEND_HINT} className="cursor-help">
                        <Info className="h-3 w-3" />
                      </span>
                    </span>
                  </th>
                  <th className="r">CPL</th>
                  <th className="r">Revenue</th>
                  <th className="r">Profit</th>
                  <th className="r">
                    <span className="inline-flex items-center justify-end gap-1">
                      Margin
                      <span title={MARGIN_HINT} aria-label={MARGIN_HINT} className="cursor-help">
                        <Info className="h-3 w-3" />
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.campaignName}-${r.supplier}-${i}`}>
                    <td className="rpt-camp">{r.campaignName}</td>
                    <td><span className="rpt-vert">{r.vertical}</span></td>
                    <td className="rpt-client">
                      {/* OCT-42: render multi-buyer rows as "Multiple (N)" with all names in the tooltip. */}
                      {(() => {
                        const names = r.clientNames && r.clientNames.length > 0 ? r.clientNames : [r.clientName];
                        if (names.length <= 1) {
                          return <span title={names[0]}>{names[0]}</span>;
                        }
                        return (
                          <span className="cursor-help" title={names.join('\n')}>
                            Multiple ({names.length})
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <span className="rpt-supplier">{r.supplier}</span>
                      {r.supplierPlatform && (
                        <span className="rpt-ncp" style={{ marginLeft: 6, textTransform: 'capitalize' }}>{r.supplierPlatform}</span>
                      )}
                    </td>
                    <td>
                      {r.catchrUrl ? (
                        <a
                          href={r.catchrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rpt-ncp inline-flex items-center gap-1 underline-offset-2 hover:underline"
                          title={r.catchrUrl}
                        >
                          <ExternalLink className="size-3 shrink-0" />
                          <span>Linked</span>
                        </a>
                      ) : (
                        <span className="rpt-ncp">Not linked</span>
                      )}
                    </td>
                    <td className="r mono">{r.leads.toLocaleString()}</td>
                    <td className="r mono">{formatCurrency(r.spend)}</td>
                    <td className="r mono">{formatCurrency(r.cpl)}</td>
                    <td className="r mono">{formatCurrency(r.revenue)}</td>
                    <td className={'r mono ' + pmCls(r.profit)}>{formatCurrency(r.profit)}</td>
                    <td {...marginProps(r.margin)}>{r.margin}%</td>
                  </tr>
                ))}
                {totals && (
                  <tr className="rpt-totals">
                    <td colSpan={5}>Totals · {reportWindow.replace('_', ' ')}</td>
                    <td className="r mono">{totals.leads.toLocaleString()}</td>
                    <td className="r mono">{formatCurrency(totals.spend)}</td>
                    <td></td>
                    <td className="r mono">{formatCurrency(totals.revenue)}</td>
                    <td className={'r mono ' + pmCls(totals.profit)}>{formatCurrency(totals.profit)}</td>
                    <td {...marginProps(totals.margin)}>{totals.margin}%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* By-campaign roll-up (mental-model affordance for Sam) */}
      {byCampaign.length > 1 && (
        <div className="card pad acard" data-testid="by-campaign-rollup">
          <h3 className="statto-title">By campaign · roll-up</h3>
          <p className="ac-sub" style={{ marginTop: 4, marginBottom: 18 }}>
            Same numbers, aggregated per campaign so you can scan the verticals quickly.
          </p>
          <div className="table-scroll">
            <table className="inv-table rpt-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Vertical</th>
                  <th className="r">Suppliers</th>
                  <th className="r">Leads</th>
                  <th className="r">
                    <span className="inline-flex items-center justify-end gap-1">
                      Spend
                      <span title={SPEND_HINT} aria-label={SPEND_HINT} className="cursor-help">
                        <Info className="h-3 w-3" />
                      </span>
                    </span>
                  </th>
                  <th className="r">Revenue</th>
                  <th className="r">Profit</th>
                  <th className="r">
                    <span className="inline-flex items-center justify-end gap-1">
                      Margin
                      <span title={MARGIN_HINT} aria-label={MARGIN_HINT} className="cursor-help">
                        <Info className="h-3 w-3" />
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {byCampaign.map((g) => {
                  const subLeads = g.rows.reduce((s, r) => s + r.leads, 0);
                  const subSpend = g.rows.reduce((s, r) => s + r.spend, 0);
                  const subRevenue = g.rows.reduce((s, r) => s + r.revenue, 0);
                  const subProfit = subRevenue - subSpend;
                  const subMargin = subRevenue > 0 ? Math.round(((subRevenue - subSpend) / subRevenue) * 1000) / 10 : 0;
                  return (
                    <tr key={g.name}>
                      <td className="rpt-camp">
                        <Link to={`/campaigns?search=${encodeURIComponent(g.name)}`} className="underline-offset-2 hover:underline" title={g.name}>
                          {g.name}
                        </Link>
                      </td>
                      <td><span className="rpt-vert">{g.vertical}</span></td>
                      <td className="r mono">{g.rows.length}</td>
                      <td className="r mono">{subLeads.toLocaleString()}</td>
                      <td className="r mono">{formatCurrency(subSpend)}</td>
                      <td className="r mono">{formatCurrency(subRevenue)}</td>
                      <td className={'r mono ' + pmCls(subProfit)}>{formatCurrency(subProfit)}</td>
                      <td {...marginProps(subMargin)}>{subMargin}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By-source roll-up — Sam (2026-05-15 meeting #10): "Facebook spend →
          Facebook profit / margin" — same rows summed across campaigns so the
          per-platform performance is one scan away. Match the per-(campaign ×
          supplier) tooltips above so the cost-concept disambiguation is
          identical everywhere. */}
      {bySource.length > 0 && (
        <div className="card pad acard" data-testid="by-source-rollup">
          <h3 className="statto-title">By source · profitability</h3>
          <p className="ac-sub" style={{ marginTop: 4, marginBottom: 18 }}>
            Aggregated per platform — same numbers, summed across campaigns so you can
            scan source-level performance.
          </p>
          <div className="table-scroll">
            <table className="inv-table rpt-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Catchr NCP</th>
                  <th className="r">Leads</th>
                  <th className="r">
                    <span className="inline-flex items-center justify-end gap-1">
                      Spend
                      <span title={SPEND_HINT} aria-label={SPEND_HINT} className="cursor-help">
                        <Info className="h-3 w-3" />
                      </span>
                    </span>
                  </th>
                  <th className="r">CPL</th>
                  <th className="r">Revenue</th>
                  <th className="r">Profit</th>
                  <th className="r">
                    <span className="inline-flex items-center justify-end gap-1">
                      Margin
                      <span title={MARGIN_HINT} aria-label={MARGIN_HINT} className="cursor-help">
                        <Info className="h-3 w-3" />
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((p) => (
                  <tr key={p.platform}>
                    <td className="rpt-camp" style={{ textTransform: 'capitalize' }}>{p.platform}</td>
                    <td>
                      {p.catchrUrl ? (
                        <a
                          href={p.catchrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rpt-ncp inline-flex items-center gap-1 underline-offset-2 hover:underline"
                          title={p.catchrUrl}
                        >
                          <ExternalLink className="size-3 shrink-0" />
                          <span>Linked</span>
                        </a>
                      ) : (
                        <span className="rpt-ncp">Not linked</span>
                      )}
                    </td>
                    <td className="r mono">{p.leads.toLocaleString()}</td>
                    <td className="r mono">{formatCurrency(p.spend)}</td>
                    <td className="r mono">{formatCurrency(p.cpl)}</td>
                    <td className="r mono">{formatCurrency(p.revenue)}</td>
                    <td className={'r mono ' + pmCls(p.profit)}>{formatCurrency(p.profit)}</td>
                    <td {...marginProps(p.margin)}>{p.margin}%</td>
                  </tr>
                ))}
                {totals && (
                  <tr className="rpt-totals">
                    <td colSpan={2}>Totals · {reportWindow.replace('_', ' ')}</td>
                    <td className="r mono">{totals.leads.toLocaleString()}</td>
                    <td className="r mono">{formatCurrency(totals.spend)}</td>
                    <td></td>
                    <td className="r mono">{formatCurrency(totals.revenue)}</td>
                    <td className={'r mono ' + pmCls(totals.profit)}>{formatCurrency(totals.profit)}</td>
                    <td {...marginProps(totals.margin)}>{totals.margin}%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value, onChange, allLabel, options, disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  allLabel: string;
  options: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const label = value === '' ? allLabel : value;
  const select = (next: string) => { onChange(next); setOpen(false); };
  return (
    <div className="rpt-filter" ref={ref}>
      <button
        type="button"
        className="rpt-filter-btn"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <ChevronDown className="size-[15px]" />
      </button>
      {open && !disabled && (
        <div className="rpt-menu">
          <button type="button" className="rpt-menu-opt" onClick={() => select('')}>
            <span className="rpt-check">{value === '' ? <Check className="size-[14px]" /> : null}</span>
            {allLabel}
          </button>
          {options.map((o) => (
            <button type="button" key={o} className="rpt-menu-opt" onClick={() => select(o)}>
              <span className="rpt-check">{value === o ? <Check className="size-[14px]" /> : null}</span>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TotalCard({
  label, value, fullValue, neg, hint,
}: {
  label: string;
  value: string;
  fullValue?: string;
  neg?: boolean;
  /** Optional clarification shown as a native tooltip on a small Info icon next to the label. */
  hint?: string;
}) {
  return (
    <div className="card rpt-kpi">
      <div className="rpt-kpi-l">
        {label}
        {hint && (
          <span title={hint} aria-label={hint} className="cursor-help">
            <Info className="size-[13px]" />
          </span>
        )}
      </div>
      <div className={'rpt-kpi-v mono' + (neg ? ' neg' : '')} title={fullValue ?? value}>
        {value}
      </div>
    </div>
  );
}
