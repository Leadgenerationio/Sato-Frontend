import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Megaphone, Users, ReceiptText, BadgeCheck, ChevronDown, ArrowUpRight,
  ShieldCheck, FileSignature, UserCog, Pencil, Plus, RotateCcw, Check, GripVertical,
  X, ChevronUp, Image as ImageIcon, ArrowRight, Headset, Phone, MessageSquare, BarChart3,
} from 'lucide-react';
import { usePortalDashboard, usePortalInvoices, usePortalLeads, usePortalCompliance } from '@/lib/hooks/use-portal';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { useAuth } from '@/components/providers/auth-provider';
import { formatCurrency } from '@/lib/currency';
import { platformLabel } from '@/lib/hooks/use-ad-spend';
import { toMoney } from '@/lib/hooks/use-invoices';
import { Skeleton } from '@/components/ui/skeleton';

// ── Portal dashboard, restyled to the Statto design (Stato Portal.html).
// Editable card grid (drag / add / remove, persisted to localStorage) ported
// from portal/dashboard.jsx. Cards are wired to the real portal API; the few
// fields the backend can't supply yet (account-manager identity) are rendered
// with a "sample" flag and documented in PORTAL_REDESIGN_BACKEND.md.

const PALETTE = ['var(--statto-ink)', 'var(--lime-500)', 'var(--green-300)', 'var(--lime-600)', 'var(--green-500)'];

function niceTicks(maxValue: number): number[] {
  const safe = Math.max(maxValue, 1);
  const pow = Math.pow(10, Math.floor(Math.log10(safe)));
  const top = Math.ceil(safe / pow) * pow;
  // 5 evenly-spaced ticks, high → low (matches the design's 28/21/14/7/0).
  return [4, 3, 2, 1, 0].map((i) => Math.round((top / 4) * i));
}

function MockTag({ label = 'sample' }: { label?: string }) {
  return <span className="mock-flag" title="Placeholder — backend does not supply this field yet">{label}</span>;
}

// ── Time-period presets that drive the deliveries chart + ad-spend breakdown ──
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
const monthStart = (back = 0) => { const n = new Date(); return isoDate(new Date(n.getFullYear(), n.getMonth() - back, 1)); };
const monthEnd = (back = 0) => { const n = new Date(); return isoDate(new Date(n.getFullYear(), n.getMonth() - back + 1, 0)); };
const weekStart = () => { const n = new Date(); const dow = n.getDay() === 0 ? 6 : n.getDay() - 1; return isoDate(new Date(n.getFullYear(), n.getMonth(), n.getDate() - dow)); };

interface Period { value: string; label: string; from: () => string; to: () => string; }

// Deliveries can use any range (daily lead rows exist for any window).
const DELIVERY_PERIODS: Period[] = [
  { value: 'last_14', label: 'Last 14 days', from: () => dayOffset(-13), to: () => dayOffset(0) },
  { value: 'last_7', label: 'Last 7 days', from: () => dayOffset(-6), to: () => dayOffset(0) },
  { value: 'this_month', label: 'This month', from: () => monthStart(0), to: () => dayOffset(0) },
  { value: 'last_month', label: 'Last month', from: () => monthStart(1), to: () => monthEnd(1) },
];
// Ad spend needs a LeadByte preset window for the per-source breakdown.
const SPEND_PERIODS: Period[] = [
  { value: 'this_month', label: 'This Month', from: () => monthStart(0), to: () => dayOffset(0) },
  { value: 'last_month', label: 'Last Month', from: () => monthStart(1), to: () => monthEnd(1) },
  { value: 'this_week', label: 'This Week', from: () => weekStart(), to: () => dayOffset(0) },
];
const rangeOf = (periods: Period[], value: string) => {
  const p = periods.find((x) => x.value === value) ?? periods[0];
  return { from: p.from(), to: p.to() };
};
const labelOf = (periods: Period[], value: string) => (periods.find((x) => x.value === value) ?? periods[0]).label;

// Interactive period selector (replaces the old static `.dd` label).
function PeriodDropdown({ value, options, onChange }: { value: string; options: Period[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  return (
    <span className="dd-wrap" ref={ref}>
      <button type="button" className="dd" onClick={() => setOpen((o) => !o)}>
        {labelOf(options, value)} <ChevronDown className="size-[15px]" />
      </button>
      {open && (
        <div className="dd-menu">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              className={'dd-opt' + (o.value === value ? ' on' : '')}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// ── Lead deliveries chart (custom bar/area, ported from the design) ──
function LeadChart({ deliveries }: { deliveries: { d: string; v: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const ticks = useMemo(() => niceTicks(Math.max(...deliveries.map((d) => d.v), 0)), [deliveries]);
  const max = ticks[0] || 1;

  return (
    <div className="lead-chart">
      <div className="lc-yaxis">
        {ticks.map((t) => (
          <span key={t} style={{ top: `${(1 - t / max) * 100}%` }}>{t}</span>
        ))}
      </div>
      <div className="lc-plot">
        {ticks.map((t) => (
          <div key={t} className={'lc-grid' + (t === 0 ? ' base' : '')} style={{ top: `${(1 - t / max) * 100}%` }} />
        ))}
        <div className="lc-bars">
          {deliveries.map((d, i) => (
            <div key={d.d + i} className="lc-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div
                className={'lc-bar' + (hover === i ? ' on' : '') + (d.v === 0 ? ' empty' : '')}
                style={{ height: `${(d.v / max) * 100}%` }}
              />
              {hover === i && d.v > 0 && (
                <div className="lc-tip" style={{ bottom: `${(d.v / max) * 100}%` }}>
                  <strong>{d.v}</strong> leads<span>{d.d}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="lc-xaxis">
        {deliveries.map((d, i) => <span key={d.d + i}>{d.d}</span>)}
      </div>
    </div>
  );
}

interface DashData {
  go: (slug: string) => void;
  companyName: string;
  stats: { id: string; icon: React.ElementType; value: string; label: string; badge?: string; lime?: boolean }[];
  deliveries: { d: string; v: number }[];
  adSpend: { platform: string; amount: number; leads: number; currency: string; color: string }[];
  adSpendReal: boolean;
  // Sam 2026-06-15: the admin "Client type / Ad-spend visibility" toggle.
  // managed → client sees the Ad Spend card; ppl (pay-per-lead) → it's removed
  // from the dashboard entirely. Backend already empties the spend data for
  // ppl; this also hides the card outright (the by-source lead rows would
  // otherwise keep an all-zero card alive).
  adSpendVisible: boolean;
  invoices: { outstanding: number; outstandingCount: number; paidCount: number; nextDue?: { number: string; due: string; total: number; currency: string } };
  leadsThisMonth: number;
  activeCampaigns: number;
  quality: { valid: number; invalid: number; rate: number } | null;
  compliance: { cleared: number; actionNeeded: number; total: number } | null;
  creatives: { live: number; review: number } | null;
  userName: string;
  deliveryPeriod: string;
  spendPeriod: string;
  deliveryPeriodLabel: string;
  spendPeriodLabel: string;
  onDeliveryPeriod: (v: string) => void;
  onSpendPeriod: (v: string) => void;
}

function StatCard({ stat }: { stat: DashData['stats'][number] }) {
  return (
    <div className={'pstat' + (stat.lime ? ' lime' : '')}>
      <div className="pstat-top">
        <span className="pstat-ic" style={stat.lime ? { background: 'rgba(6,47,40,.10)' } : undefined}>
          <stat.icon className="size-5" />
        </span>
        {stat.badge && <span className="pstat-badge">{stat.badge}</span>}
      </div>
      <div className="pstat-val mono">{stat.value}</div>
      <div className="pstat-lab">{stat.label}</div>
    </div>
  );
}

function AdSpendCard({ d }: { d: DashData }) {
  const total = d.adSpend.reduce((s, p) => s + p.amount, 0);
  const totalLeads = d.adSpend.reduce((s, p) => s + p.leads, 0);
  const max = Math.max(...d.adSpend.map((p) => p.amount), 1);
  const currency = d.adSpend[0]?.currency ?? 'GBP';
  return (
    <div className="card pad spend-card">
      <div className="lc-head">
        <div>
          <h3 className="statto-title">Ad Spend by Platform</h3>
          <p className="lc-sub">{d.spendPeriodLabel} · across {d.adSpend.length} platform{d.adSpend.length === 1 ? '' : 's'}</p>
        </div>
        <PeriodDropdown value={d.spendPeriod} options={SPEND_PERIODS} onChange={d.onSpendPeriod} />
      </div>
      <div className="spend-grid">
        <div className="spend-summary">
          <span className="spend-sum-lab">Total ad spend</span>
          <span className="spend-sum-val mono">{formatCurrency(total, currency)}</span>
          {totalLeads > 0 && (
            <div className="spend-sum-foot">
              <span>{totalLeads.toLocaleString()} leads</span>
              <span className="dot-sep">·</span>
              <span>{formatCurrency(Math.round(total / totalLeads), currency)} avg CPL</span>
            </div>
          )}
        </div>
        <div className="spend-list">
          {d.adSpend.map((p) => (
            <div key={p.platform} className="spend-row">
              <div className="spend-label">
                <span className="spend-dot" style={{ background: p.color }} />
                <span className="spend-name">{p.platform}</span>
                {p.leads > 0 && (
                  <span className="spend-meta">{p.leads} leads · {formatCurrency(Math.round(p.amount / p.leads), p.currency)} CPL</span>
                )}
              </div>
              <div className="spend-track">
                <span className="spend-fill" style={{ width: `${(p.amount / max) * 100}%`, background: p.color }} />
              </div>
              <span className="spend-amt mono">{formatCurrency(p.amount, p.currency)}</span>
              <span className="spend-pct">{total > 0 ? Math.round((p.amount / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Snap({ icon: Icon, title, hint, onClick, children }: {
  icon: React.ElementType; title: string; hint?: React.ReactNode; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button className="snap card" onClick={onClick}>
      <div className="snap-head">
        <span className="snap-ic"><Icon className="size-[18px]" /></span>
        <span className="snap-title">{title}</span>
        {hint && <span className="snap-hint">{hint}</span>}
        <span className="snap-go"><ArrowUpRight className="size-4" /></span>
      </div>
      <div className="snap-body">{children}</div>
    </button>
  );
}

function SnapshotGrid({ d }: { d: DashData }) {
  return (
    <div>
      <div className="snap-section">Your account at a glance</div>
      <div className="snap-grid">
        <Snap icon={BarChart3} title="Leads" hint={`${d.leadsThisMonth} this month`} onClick={() => d.go('leads')}>
          <div className="snap-amt mono">{d.leadsThisMonth.toLocaleString()}</div>
          <div className="snap-sub">delivered this month</div>
          <div className="snap-tags"><span className="pill p-soft">{d.activeCampaigns} active campaign{d.activeCampaigns === 1 ? '' : 's'}</span></div>
        </Snap>

        <Snap icon={ReceiptText} title="Invoices" onClick={() => d.go('invoices')}>
          <div className="snap-amt mono">{formatCurrency(d.invoices.outstanding)}</div>
          <div className="snap-sub">{d.invoices.nextDue ? `Outstanding · due ${d.invoices.nextDue.due}` : 'Outstanding'}</div>
          <div className="snap-tags">
            {d.invoices.outstandingCount > 0 && <span className="pill p-warn">{d.invoices.outstandingCount} outstanding</span>}
            {d.invoices.paidCount > 0 && <span className="pill p-soft">{d.invoices.paidCount} paid</span>}
          </div>
        </Snap>

        {d.compliance && (
          <Snap icon={ShieldCheck} title="Compliance" onClick={() => d.go('compliance')}>
            <div className="snap-meter">
              <span className="snap-meter-fill" style={{ width: `${d.compliance.total ? (d.compliance.cleared / d.compliance.total) * 100 : 100}%` }} />
            </div>
            <div className="snap-sub">{d.compliance.cleared} of {d.compliance.total} items cleared</div>
            <div className="snap-tags">
              {d.compliance.cleared > 0 && <span className="pill p-soft">{d.compliance.cleared} cleared</span>}
              {d.compliance.actionNeeded > 0 && <span className="pill p-warn">{d.compliance.actionNeeded} action needed</span>}
            </div>
          </Snap>
        )}

        {d.creatives && (
          <Snap icon={Megaphone} title="Creatives" onClick={() => d.go('creatives')}>
            <div className="snap-thumbs">
              <span className="snap-thumb"><ImageIcon className="size-4" /></span>
              <span className="snap-thumb"><ImageIcon className="size-4" /></span>
              <span className="snap-thumb"><ImageIcon className="size-4" /></span>
            </div>
            <div className="snap-tags">
              {d.creatives.live > 0 && <span className="pill p-soft">{d.creatives.live} live</span>}
              {d.creatives.review > 0 && <span className="pill p-warn">{d.creatives.review} in review</span>}
            </div>
          </Snap>
        )}

        <Snap icon={FileSignature} title="Agreement" hint={d.stats.find((s) => s.id === 'agreement')?.badge} onClick={() => d.go('agreement')}>
          <div className="snap-amt mono">{d.stats.find((s) => s.id === 'agreement')?.value}</div>
          <div className="snap-sub">Service agreement status</div>
        </Snap>

        <Snap icon={UserCog} title="Account" onClick={() => d.go('account')}>
          <div className="snap-kv"><span>Signed in as</span><strong>{d.userName}</strong></div>
          <div className="snap-kv"><span>Company</span><strong>{d.companyName}</strong></div>
        </Snap>
      </div>
    </div>
  );
}

function InvoiceDueCard({ d }: { d: DashData }) {
  const due = d.invoices.nextDue;
  if (!due) {
    return (
      <div className="card pad mini-wide">
        <div className="mw-ic"><ReceiptText className="size-[22px]" /></div>
        <div className="mw-body"><div className="mw-row"><h3 className="statto-title">Next Invoice Due</h3></div><p className="mw-sub">Nothing outstanding — you're all paid up.</p></div>
      </div>
    );
  }
  return (
    <div className="card pad mini-wide">
      <div className="mw-ic"><ReceiptText className="size-[22px]" /></div>
      <div className="mw-body">
        <div className="mw-row"><h3 className="statto-title">Next Invoice Due</h3></div>
        <p className="mw-sub">{due.number} · due {due.due}</p>
      </div>
      <div className="mw-end">
        <span className="mw-amt mono">{formatCurrency(due.total, due.currency)}</span>
        <button className="btn b-primary b-sm" onClick={() => d.go('invoices')}><ArrowRight className="size-[15px]" /> View</button>
      </div>
    </div>
  );
}

function LeadQualityCard({ d }: { d: DashData }) {
  if (!d.quality) {
    return (
      <div className="card pad"><div className="lc-head" style={{ marginBottom: 14 }}><div><h3 className="statto-title">Lead Quality</h3><p className="lc-sub">No scored leads this month yet</p></div></div></div>
    );
  }
  const { valid, invalid, rate } = d.quality;
  return (
    <div className="card pad">
      <div className="lc-head" style={{ marginBottom: 14 }}>
        <div><h3 className="statto-title">Lead Quality</h3><p className="lc-sub">This month · {valid + invalid} scored</p></div>
        <span className="pill p-soft">{rate}% valid</span>
      </div>
      <div className="snap-meter" style={{ height: 10 }}><span className="snap-meter-fill" style={{ width: rate + '%' }} /></div>
      <div className="lq-tags">
        <span className="pill p-soft">{valid} valid</span>
        <span className="pill p-neg">{invalid} invalid</span>
      </div>
    </div>
  );
}

function SupportCard() {
  return (
    <div className="card pad mini-wide">
      <div className="mw-ic lime"><Headset className="size-[22px]" /></div>
      <div className="mw-body">
        <div className="mw-row"><h3 className="statto-title">Your Account Manager</h3><MockTag /></div>
        <p className="mw-sub">Contact your account manager via the team.</p>
      </div>
      <div className="mw-end">
        <button className="btn b-ghost b-sm"><Phone className="size-[15px]" /> Call</button>
        <button className="btn b-dark b-sm"><MessageSquare className="size-[15px]" /> Message</button>
      </div>
    </div>
  );
}

const DASH_BLOCKS = [
  { id: 'stats', title: 'Headline stats' },
  { id: 'deliveries', title: 'Recent Lead Deliveries' },
  { id: 'adspend', title: 'Ad Spend by Platform' },
  { id: 'snapshots', title: 'Account at a glance' },
  { id: 'invoice', title: 'Next Invoice Due' },
  { id: 'quality', title: 'Lead Quality' },
  { id: 'support', title: 'Account Manager' },
];
const DASH_DEFAULT = ['stats', 'deliveries', 'adspend', 'snapshots'];
const DASH_KEY = 'stato-portal-dash-v1';

function DashboardGrid({ d }: { d: DashData }) {
  const [editing, setEditing] = useState(false);
  // Sam 2026-06-15: the Ad Spend block only exists for managed clients (the
  // admin toggle). Drop it from the catalogue when hidden so it can't be
  // rendered, added from the menu, or reset back in; everything downstream
  // keys off this filtered list.
  const blocks = d.adSpendVisible ? DASH_BLOCKS : DASH_BLOCKS.filter((b) => b.id !== 'adspend');
  const defaults = DASH_DEFAULT.filter((id) => blocks.some((b) => b.id === id));
  const [active, setActive] = useState<string[]>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(DASH_KEY) ?? 'null');
      if (Array.isArray(s) && s.length) return s.filter((id: string) => blocks.some((b) => b.id === id));
    } catch { /* ignore */ }
    return defaults;
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Keep the ad-spend card in sync with the admin toggle, so the client never
  // has to edit their dashboard manually:
  //   • toggle ON  → ensure the card is present (re-add it at its default slot,
  //     just after Recent Lead Deliveries, if a saved layout dropped it).
  //   • toggle OFF → strip it from the layout.
  useEffect(() => {
    setActive((a) => {
      const has = a.includes('adspend');
      if (d.adSpendVisible && !has) {
        const after = a.indexOf('deliveries');
        const next = [...a];
        next.splice(after >= 0 ? after + 1 : next.length, 0, 'adspend');
        return next;
      }
      if (!d.adSpendVisible && has) return a.filter((x) => x !== 'adspend');
      return a;
    });
  }, [d.adSpendVisible]);

  const hidden = blocks.filter((b) => !active.includes(b.id));
  const titleOf = (id: string) => blocks.find((b) => b.id === id)?.title;

  const save = () => { localStorage.setItem(DASH_KEY, JSON.stringify(active)); setEditing(false); setAddOpen(false); };
  const resetLayout = () => { setActive(defaults); localStorage.removeItem(DASH_KEY); };
  const remove = (id: string) => setActive((a) => a.filter((x) => x !== id));
  const add = (id: string) => { setActive((a) => [...a, id]); setAddOpen(false); };
  const move = (i: number, dir: number) => setActive((a) => {
    const j = i + dir;
    if (j < 0 || j >= a.length) return a;
    const next = [...a];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const onDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const next = [...active];
    const [m] = next.splice(dragIdx, 1);
    next.splice(i, 0, m);
    setActive(next); setDragIdx(null); setOverIdx(null);
  };

  const renderBlock = (id: string) => {
    switch (id) {
      case 'stats': return <div className="stat-row">{d.stats.map((s) => <StatCard key={s.id} stat={s} />)}</div>;
      case 'deliveries': return (
        <div className="card pad lead-card">
          <div className="lc-head">
            <div><h3 className="statto-title">Recent Lead Deliveries</h3><p className="lc-sub">{d.deliveryPeriodLabel}</p></div>
            <PeriodDropdown value={d.deliveryPeriod} options={DELIVERY_PERIODS} onChange={d.onDeliveryPeriod} />
          </div>
          <LeadChart deliveries={d.deliveries} />
        </div>
      );
      case 'adspend':
        // Pay-per-lead clients never reach here: the block is filtered out of
        // `blocks` when adSpendVisible is false (Sam 2026-06-15).
        return d.adSpend.length > 0
          ? <AdSpendCard d={d} />
          : <div className="dash-empty">No ad-spend data for this month yet.</div>;
      case 'snapshots': return <SnapshotGrid d={d} />;
      case 'invoice': return <InvoiceDueCard d={d} />;
      case 'quality': return <LeadQualityCard d={d} />;
      case 'support': return <SupportCard />;
      default: return null;
    }
  };

  return (
    <div className="screen">
      <div className="dash-toolbar">
        {!editing ? (
          <button className="btn b-ghost b-sm" onClick={() => setEditing(true)}><Pencil className="size-[15px]" /> Edit dashboard</button>
        ) : (
          <>
            <div className="addcard-dd">
              <button className="btn b-ghost b-sm" onClick={() => setAddOpen((o) => !o)} disabled={!hidden.length}>
                <Plus className="size-[15px]" /> Add card <ChevronDown className="size-[14px]" />
              </button>
              {addOpen && hidden.length > 0 && (
                <div className="addcard-menu">
                  {hidden.map((b) => (
                    <button key={b.id} className="addcard-opt" onClick={() => add(b.id)}>
                      <Plus className="size-[14px]" /> {b.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn b-ghost b-sm" onClick={resetLayout}><RotateCcw className="size-[15px]" /> Reset</button>
            <button className="btn b-primary b-sm" onClick={save}><Check className="size-[15px]" /> Save</button>
          </>
        )}
      </div>

      {editing && (
        <div className="edit-hint">
          <GripVertical className="size-4" /> Drag cards to rearrange, remove with ×, or add more from the <strong>Add card</strong> menu. Press <strong>Save</strong> when done.
        </div>
      )}

      {active.map((id, i) => (
        <div
          key={id}
          className={'pblock' + (editing ? ' editing' : '') + (dragIdx === i ? ' dragging' : '') + (overIdx === i && dragIdx !== null && dragIdx !== i ? ' over' : '')}
          draggable={editing}
          onDragStart={() => editing && setDragIdx(i)}
          onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
          onDragOver={(e) => { if (editing) { e.preventDefault(); if (i !== overIdx) setOverIdx(i); } }}
          onDrop={() => editing && onDrop(i)}
        >
          {editing && (
            <div className="pblock-bar">
              <span className="phandle"><GripVertical className="size-[13px]" /> {titleOf(id)}</span>
              <button className="premove" onClick={() => remove(id)} title="Remove card"><X className="size-[15px]" /></button>
            </div>
          )}
          {editing && (
            <div className="pblock-move">
              <button className="pmove-btn" disabled={i === 0} onClick={() => move(i, -1)} title="Move up"><ChevronUp className="size-[18px]" /></button>
              <button className="pmove-btn" disabled={i === active.length - 1} onClick={() => move(i, 1)} title="Move down"><ChevronDown className="size-[18px]" /></button>
            </div>
          )}
          {renderBlock(id)}
        </div>
      ))}

      {editing && active.length === 0 && (
        <div className="dash-empty">No cards. Use <strong>Add card</strong> to choose what to show.</div>
      )}
    </div>
  );
}

export function PortalDashboardPage() {
  usePageTitle('Stato — Dashboard');
  const { user } = useAuth();
  const { data: dashboard, isLoading } = usePortalDashboard();
  const { data: invoices } = usePortalInvoices();
  const { data: compliance } = usePortalCompliance();

  // Independent period selectors for the two cards.
  const [deliveryPeriod, setDeliveryPeriod] = useState('last_14');
  const [spendPeriod, setSpendPeriod] = useState('this_month');
  const deliveryRange = useMemo(() => rangeOf(DELIVERY_PERIODS, deliveryPeriod), [deliveryPeriod]);
  const spendRange = useMemo(() => rangeOf(SPEND_PERIODS, spendPeriod), [spendPeriod]);
  // Fixed "this month" range for lead quality (independent of the dropdowns).
  const monthRange = useMemo(() => ({ from: monthStart(0), to: dayOffset(0) }), []);

  const { data: deliveryLeads } = usePortalLeads(deliveryRange);
  const { data: spendLeads } = usePortalLeads(spendRange);
  const { data: leadsData } = usePortalLeads(monthRange);

  const dashData = useMemo<DashData | null>(() => {
    if (!dashboard) return null;

    const stats: DashData['stats'] = [
      { id: 'campaigns', icon: Megaphone, value: String(dashboard.activeCampaigns), label: 'Active Campaigns' },
      { id: 'leads', icon: Users, value: dashboard.totalLeadsThisMonth.toLocaleString(), label: 'Leads This Month' },
      { id: 'owed', icon: ReceiptText, value: formatCurrency(dashboard.totalOutstanding), label: 'Outstanding' },
      { id: 'agreement', icon: BadgeCheck, value: dashboard.agreementSigned ? 'Signed' : 'Pending', label: 'Agreement', badge: dashboard.agreementSigned ? 'Active' : 'Action', lime: dashboard.agreementSigned },
    ];

    // Recent lead deliveries — daily valid-lead volume across the selected
    // window, gap-filled so every day in range renders a bar.
    const dRows = deliveryLeads?.leads ?? [];
    const daySums = new Map<string, number>();
    for (const r of dRows) daySums.set(r.date, (daySums.get(r.date) ?? 0) + r.validLeads);
    const deliveries: { d: string; v: number }[] = [];
    {
      const start = new Date(`${deliveryRange.from}T00:00:00`);
      const end = new Date(`${deliveryRange.to}T00:00:00`);
      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        deliveries.push({ d: dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), v: daySums.get(isoDate(dt)) ?? 0 });
      }
    }

    // Ad spend — real leads + spend per platform from the LeadByte "by source"
    // breakdown for the selected preset window. Falls back to the dashboard's
    // spend-only adSpendByPlatform (MTD) only when "This Month" is selected.
    const bySource = spendLeads?.bySource ?? [];
    let adSpend: DashData['adSpend'] = bySource.map((r, i) => ({
      platform: platformLabel(r.platform), amount: r.spend, leads: r.leads, currency: r.currency, color: PALETTE[i % PALETTE.length],
    }));
    let adSpendReal = adSpend.length > 0;
    if (adSpend.length === 0 && spendPeriod === 'this_month' && dashboard.adSpendByPlatform?.length) {
      adSpend = dashboard.adSpendByPlatform.map((r, i) => ({
        platform: platformLabel(r.platform), amount: r.spend, leads: 0, currency: r.currency, color: PALETTE[i % PALETTE.length],
      }));
      adSpendReal = false;
    }

    // Lead quality — valid vs invalid from the leads daily rows.
    const days = leadsData?.leads ?? [];
    const valid = days.reduce((s, x) => s + x.validLeads, 0);
    const invalid = days.reduce((s, x) => s + x.invalidLeads, 0);
    const quality = valid + invalid > 0 ? { valid, invalid, rate: Math.round((valid / (valid + invalid)) * 100) } : null;

    // Invoices summary
    const HIDDEN = new Set(['draft', 'voided', 'deleted']);
    const visibleInv = (invoices ?? []).filter((i) => !HIDDEN.has((i.status ?? '').toLowerCase()));
    const outstandingInv = visibleInv.filter((i) => i.status !== 'paid');
    const outstanding = outstandingInv.reduce((s, i) => s + toMoney(i.total), 0);
    const paidCount = visibleInv.filter((i) => i.status === 'paid').length;
    const nextDueInv = outstandingInv.slice().sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Compliance + creatives counts (across campaigns)
    let complianceSummary: DashData['compliance'] = null;
    let creativesSummary: DashData['creatives'] = null;
    if (compliance) {
      const allCreatives = compliance.flatMap((c) => c.creatives);
      const approved = allCreatives.filter((c) => c.approval?.status === 'approved').length;
      const pending = allCreatives.filter((c) => (c.approval?.status ?? 'pending') !== 'approved').length;
      const total = allCreatives.length;
      if (total > 0) {
        complianceSummary = { cleared: approved, actionNeeded: pending, total };
        creativesSummary = { live: approved, review: pending };
      }
    }

    // Sam 2026-06-15: only managed clients see ad spend. Pay-per-lead clients
    // get spend zeroed server-side; hide the card entirely so they don't see a
    // confusing "£0.00 / NaN%" panel.
    return {
      go: () => {},
      companyName: dashboard.companyName,
      stats,
      deliveries,
      adSpend,
      adSpendReal,
      adSpendVisible: dashboard.clientType === 'managed',
      invoices: {
        outstanding,
        outstandingCount: outstandingInv.length,
        paidCount,
        nextDue: nextDueInv ? { number: nextDueInv.invoiceNumber, due: fmtDate(nextDueInv.dueDate), total: toMoney(nextDueInv.total), currency: nextDueInv.currency } : undefined,
      },
      leadsThisMonth: dashboard.totalLeadsThisMonth,
      activeCampaigns: dashboard.activeCampaigns,
      quality,
      compliance: complianceSummary,
      creatives: creativesSummary,
      userName: user?.name ?? '—',
      deliveryPeriod,
      spendPeriod,
      deliveryPeriodLabel: labelOf(DELIVERY_PERIODS, deliveryPeriod),
      spendPeriodLabel: labelOf(SPEND_PERIODS, spendPeriod),
      onDeliveryPeriod: setDeliveryPeriod,
      onSpendPeriod: setSpendPeriod,
    };
  }, [dashboard, deliveryLeads, spendLeads, leadsData, invoices, compliance, user, deliveryRange, spendRange, deliveryPeriod, spendPeriod]);

  const navigate = useNavigate();

  if (isLoading || !dashData) {
    return (
      <div className="screen" style={{ paddingTop: 8 }}>
        <Skeleton className="h-9 w-40 self-end rounded-xl" />
        <div className="stat-row">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[168px] rounded-3xl" />)}</div>
        <Skeleton className="h-[360px] rounded-3xl" />
      </div>
    );
  }

  const data: DashData = { ...dashData, go: (slug) => navigate(slug === 'leads' ? '/portal/leads' : `/portal/${slug}`) };
  return <DashboardGrid d={data} />;
}
