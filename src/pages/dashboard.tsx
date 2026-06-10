import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PoundSterling, Users, TrendingUp, Activity, CreditCard, ArrowUpRight,
  ChevronDown, ChevronUp, Pencil, Plus, RotateCcw, Check, GripVertical, X,
  Landmark, Wallet, ReceiptText, ShieldAlert, Bell, SquareCheckBig, FileText,
  Clock, CirclePause, CircleCheck, TriangleAlert, CircleAlert, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { api, unwrap } from '@/lib/api';
import {
  useDashboardStats, useFinancialOverview, useLeadsByDay, useRecentActivity,
  DASHBOARD_WINDOW_OPTIONS, type DashboardWindow, type FinancialOverviewRow,
} from '@/lib/hooks/use-dashboard';
import { useCampaigns, type CampaignSummary } from '@/lib/hooks/use-campaigns';
import { useCreditAlerts } from '@/lib/hooks/use-clients';
import { useTaskStats } from '@/lib/hooks/use-tasks';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { toMoney, type InvoiceSummary } from '@/lib/hooks/use-invoices';
import { formatPercentCapped } from '@/lib/currency';

// ── Stato Admin dashboard, restyled to the Statto design (Admin Dashboard.html).
// Editable card grid (drag/add/remove/save → localStorage) ported from
// dash-app.jsx. Cards wire to the real dashboard/finance hooks; the dev-mock
// layer feeds them realistic data when no backend is running.

const gbp0 = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
const PALETTE = ['var(--statto-ink)', 'var(--green-700)', 'var(--green-500)', 'var(--green-300)', 'var(--gray-400)', 'var(--gray-300)'];

function smooth(p: number[][]): string {
  if (p.length < 2) return '';
  let s = `M ${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
    const c1x = b[0] + (c[0] - a[0]) / 6, c1y = b[1] + (c[1] - a[1]) / 6;
    const c2x = c[0] - (e[0] - b[0]) / 6, c2y = c[1] - (e[1] - b[1]) / 6;
    s += ` C ${c1x},${c1y} ${c2x},${c2y} ${c[0]},${c[1]}`;
  }
  return s;
}
function niceMax(v: number): number {
  const safe = Math.max(v, 1);
  const pow = Math.pow(10, Math.floor(Math.log10(safe)));
  return Math.ceil(safe / pow) * pow;
}

function CardHead({ title, sub, icon: Icon, tint }: { title: string; sub?: string; icon?: React.ElementType; tint?: string }) {
  return (
    <div className="ac-head">
      <div>
        <h3 className="statto-title">{title}</h3>
        {sub && <p className="ac-sub">{sub}</p>}
      </div>
      {Icon && <span className={'ac-ic' + (tint ? ' ' + tint : '')}><Icon className="size-5" /></span>}
    </div>
  );
}

// ─────────── Charts ───────────
function RevenueChart({ rows }: { rows: FinancialOverviewRow[] }) {
  const maxVal = Math.max(...rows.map((r) => Math.max(r.revenue, r.expenses ?? 0)), 1);
  const max = niceMax(maxVal);
  const ticks = [4, 3, 2, 1, 0].map((i) => Math.round((max / 4) * i));
  const n = rows.length;
  const xp = (i: number) => (n > 1 ? i / (n - 1) : 0.5);
  const yp = (v: number) => 1 - v / max;
  const revPts = rows.map((r, i) => [xp(i), yp(r.revenue)]);
  const spendIdx = rows.map((r, i) => (r.expenses == null ? null : i)).filter((i): i is number => i != null);
  const spendPts = spendIdx.map((i) => [xp(i), yp(rows[i].expenses ?? 0)]);
  const revLine = smooth(revPts);
  const revArea = revLine + ' L 1,1 L 0,1 Z';
  const spendLine = smooth(spendPts);
  return (
    <div className="achart">
      <div className="achart-y">{ticks.map((t) => <span key={t} style={{ top: `${yp(t) * 100}%` }}>£{Math.round(t / 1000)}k</span>)}</div>
      <div className="achart-plot">
        {ticks.map((t) => <div key={t} className="achart-grid" style={{ top: `${yp(t) * 100}%` }} />)}
        <svg className="achart-svg" viewBox="0 0 1 1" preserveAspectRatio="none">
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--statto-ink)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--statto-ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={revArea} fill="url(#revFill)" />
          <path d={revLine} fill="none" stroke="var(--statto-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {spendPts.length > 1 && <path d={spendLine} fill="none" stroke="var(--lime-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        </svg>
      </div>
      <div className="achart-x">{rows.map((r, i) => <span key={i}>{r.month.split(' ')[0]}</span>)}</div>
    </div>
  );
}

function LeadsWeek({ points }: { points: { day: string; leads: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...points.map((p) => p.leads), 1));
  const ticks = [4, 3, 2, 1, 0].map((i) => Math.round((max / 4) * i));
  return (
    <div className="lw-chart">
      <div className="lw-y">{ticks.map((t) => <span key={t} style={{ top: `${(1 - t / max) * 100}%` }}>{t}</span>)}</div>
      <div className="lw-plot">
        {ticks.map((t) => <div key={t} className="achart-grid" style={{ top: `${(1 - t / max) * 100}%` }} />)}
        <div className="lw-bars">
          {points.map((d, i) => (
            <div key={d.day + i} className="lw-col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className={'lw-bar' + (hover === i ? ' on' : '')} style={{ height: `${(d.leads / max) * 100}%` }} />
              {hover === i && <div className="lw-tip"><strong>{d.leads}</strong> leads<span>{d.day}</span></div>}
            </div>
          ))}
        </div>
      </div>
      <div className="lw-x">{points.map((d, i) => <span key={d.day + i}>{d.day}</span>)}</div>
    </div>
  );
}

function Donut({ segments }: { segments: { name: string; pct: number; color: string }[] }) {
  const R = 54, C = 2 * Math.PI * R, sw = 26;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <div className="donut-svg-wrap">
        <svg viewBox="0 0 140 140" className="donut-svg">
          <g transform="rotate(-90 70 70)">
            {segments.map((s, i) => {
              const len = (s.pct / 100) * C;
              const el = <circle key={i} cx="70" cy="70" r={R} fill="none" style={{ stroke: s.color }} strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
              offset += len;
              return el;
            })}
          </g>
        </svg>
      </div>
      <div className="donut-legend">
        {segments.map((s, i) => (
          <div key={i} className="dleg">
            <span className="dleg-dot" style={{ background: s.color }} />
            <span className="dleg-name">{s.name}</span>
            <span className="dleg-pct mono">{s.pct % 1 === 0 ? s.pct : s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceStatus({ rows }: { rows: FinancialOverviewRow[] }) {
  const [filter, setFilter] = useState<null | 'paid' | 'pending' | 'overdue'>(null);
  const chips = [
    { id: 'paid' as const, label: 'Paid', color: 'var(--statto-ink)' },
    { id: 'pending' as const, label: 'Pending', color: 'var(--gray-400)' },
    { id: 'overdue' as const, label: 'Overdue', color: 'var(--negative)' },
  ];
  const max = niceMax(Math.max(...rows.map((r) => r.invoicesPaid + (r.invoicesPending ?? 0) + r.invoicesOverdue), 1));
  const ticks = [4, 3, 2, 1, 0].map((i) => Math.round((max / 4) * i));
  const show = (k: string) => !filter || filter === k;
  return (
    <div>
      <div className="istat-chips">
        {chips.map((c) => (
          <button key={c.id} className={'istat-chip' + (filter === c.id ? ' on' : '')} onClick={() => setFilter((f) => (f === c.id ? null : c.id))}>
            <span className="dleg-dot" style={{ background: c.color }} />{c.label}
          </button>
        ))}
      </div>
      <div className="istat-chart">
        <div className="achart-y">{ticks.map((t) => <span key={t} style={{ top: `${(1 - t / max) * 100}%` }}>{t}</span>)}</div>
        <div className="istat-plot">
          {ticks.map((t) => <div key={t} className="achart-grid" style={{ top: `${(1 - t / max) * 100}%` }} />)}
          <div className="istat-bars">
            {rows.map((d, i) => {
              const segs = [
                { k: 'overdue', v: d.invoicesOverdue, c: 'var(--negative)' },
                { k: 'pending', v: d.invoicesPending ?? 0, c: 'var(--gray-400)' },
                { k: 'paid', v: d.invoicesPaid, c: 'var(--statto-ink)' },
              ].filter((s) => show(s.k) && s.v > 0);
              return (
                <div key={i} className="istat-col">
                  <div className="istat-stack">
                    {segs.map((s, j) => <span key={s.k} className={'istat-seg' + (j === 0 ? ' top' : '')} style={{ height: `${(s.v / max) * 100}%`, background: s.c }} />)}
                  </div>
                  <span className="istat-xl">{d.month.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="istat-legend">
        {chips.slice().reverse().map((c) => <span key={c.id} className="dleg"><span className="dleg-dot" style={{ background: c.color }} />{c.label}</span>)}
      </div>
    </div>
  );
}

// ─────────── Finance cards (own queries) ───────────
interface XeroBankAccount { name: string; currency: string; balance: string; balanceDate: string | null; }
function BankCard() {
  const { data } = useQuery({
    queryKey: ['xero', 'bank-accounts'],
    queryFn: async () => unwrap(await api.get<{ configured: boolean; accounts: XeroBankAccount[] }>('/api/v1/integrations/xero/bank-accounts')),
  });
  const accounts = data?.accounts ?? [];
  const total = accounts.filter((a) => a.currency === 'GBP').reduce((s, a) => s + toMoney(a.balance), 0);
  const fmt = (a: XeroBankAccount) => {
    const sym = a.currency === 'USD' ? 'US$' : a.currency === 'GBP' ? '£' : '';
    return `${toMoney(a.balance) < 0 ? '-' : ''}${sym}${Math.abs(toMoney(a.balance)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  return (
    <div className="card pad acard">
      <CardHead title="Bank Accounts" sub="Statement balance · live from Xero" icon={Landmark} />
      <div className="bank-list">
        {accounts.map((b, i) => (
          <div key={i} className="bank-row">
            <div className="bank-meta">
              <span className="bank-name">{b.name}</span>
              {b.balanceDate && <span className="bank-sub">Statement balance · as of {new Date(b.balanceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
            </div>
            <span className={'bank-bal mono' + (toMoney(b.balance) < 0 ? ' neg' : '')}>{fmt(b)}</span>
          </div>
        ))}
        {accounts.length === 0 && <p className="ac-sub">No bank accounts connected.</p>}
      </div>
      <div className="bank-total"><span>Total (GBP)</span><strong className="mono">{gbp0(total).replace(/\.00$/, '')}</strong></div>
    </div>
  );
}

function InvoicesOwedCard({ go }: { go: (v: string) => void }) {
  const [bucket, setBucket] = useState<'all' | 'due' | 'overdue'>('all');
  const { data } = useQuery({
    queryKey: ['invoices', 'outstanding', bucket],
    queryFn: async () => (await api.get<{ invoices: InvoiceSummary[]; count: number; totalOutstanding: string }>(`/api/v1/invoices/outstanding?bucket=${bucket}`)).data ?? { invoices: [], count: 0, totalOutstanding: '0' },
  });
  const invoices = (data?.invoices ?? []).slice(0, 4);
  const total = toMoney(data?.totalOutstanding ?? '0');
  return (
    <div className="card pad acard">
      <CardHead title="Invoices Owed In" sub={`${data?.count ?? 0} invoices awaiting payment`} icon={Wallet} tint="info" />
      <div className="seg">
        {(['all', 'due', 'overdue'] as const).map((t) => (
          <button key={t} className={'seg-btn' + (bucket === t ? ' on' : '')} onClick={() => setBucket(t)} style={{ textTransform: 'capitalize' }}>{t === 'all' ? 'All' : t}</button>
        ))}
      </div>
      <div className="owed-total"><span className="owed-amt mono">{gbp0(total)}</span><span className="owed-lab">Total outstanding</span></div>
      <div className="owed-list">
        {invoices.map((o) => {
          const late = o.daysOverdue > 0;
          return (
            <div key={o.id} className="owed-row">
              <div className="owed-meta"><span className="owed-id">{o.invoiceNumber}</span><span className="owed-client">{o.clientName}</span></div>
              <span className={'pill p-' + (late ? 'warn' : 'infosoft')}>{late ? `${o.daysOverdue}d late` : o.status}</span>
              <span className="owed-amt2 mono">{gbp0(toMoney(o.total))}</span>
            </div>
          );
        })}
        {invoices.length === 0 && <p className="ac-sub">Nothing outstanding.</p>}
      </div>
      <button className="btn b-ghost b-block" onClick={() => go('invoices')}><ExternalLink className="size-[15px]" /> View all</button>
    </div>
  );
}

interface QuarterBlock { owed?: string; }
function VatCard() {
  const { data } = useQuery({
    queryKey: ['xero', 'vat-liability', 0],
    queryFn: async () => unwrap(await api.get<{ configured: boolean; currency?: string; currentQuarter?: QuarterBlock }>('/api/v1/integrations/xero/vat-liability')),
  });
  const owed = data?.currentQuarter?.owed ? toMoney(data.currentQuarter.owed) : 0;
  return (
    <div className="card pad acard">
      <CardHead title="VAT Liability" sub="HMRC quarter view, live from Xero" icon={ReceiptText} tint="warn" />
      <div className="vat-box">
        <div className="vat-val">{gbp0(owed).replace(/£0$/, '£0.00')}</div>
        <div className="vat-sub">{owed === 0 ? 'No VAT registration on this Xero organisation.' : 'Estimated VAT owed this quarter.'}</div>
      </div>
    </div>
  );
}

interface PnlSummary { fromDate: string; toDate: string; revenue: string; fixedCosts: string; oneOffCosts: string; advertisingCosts?: string; adSpend: string; totalCosts: string; netProfit: string; margin: string; uncategorisedCount: number; }
function PnlCard() {
  const { data } = useQuery({
    queryKey: ['reports', 'pnl-summary', 30],
    queryFn: async () => unwrap(await api.get<PnlSummary>('/api/v1/reports/pnl-summary?days=30')),
  });
  if (!data) return <div className="card pad acard"><CardHead title="P&L Summary" /><p className="ac-sub">Loading…</p></div>;
  const np = toMoney(data.netProfit);
  const marginPct = `${Math.round(parseFloat(data.margin) * 100)}%`;
  const range = `${new Date(data.fromDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(data.toDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const costs = [
    { label: 'Fixed costs', val: -toMoney(data.fixedCosts) },
    { label: 'One-off costs', val: -toMoney(data.oneOffCosts) },
    { label: 'Advertising (bank)', val: -toMoney(data.advertisingCosts ?? '0') },
    { label: 'Ad spend (Catchr)', val: -toMoney(data.adSpend) },
  ];
  return (
    <div className="card pad acard">
      <div className="ac-head">
        <div><h3 className="statto-title">P&amp;L Summary</h3><p className="ac-sub">{range}</p></div>
        {data.uncategorisedCount > 0 && <span className="pnl-chip"><CircleAlert className="size-[13px]" /> {data.uncategorisedCount} uncategorised</span>}
      </div>
      <div className="pnl-hero">
        <span className={'pnl-np mono' + (np < 0 ? ' neg' : '')}>{gbp0(np)}</span>
        <span className="pnl-np-sub"><TrendingUp className="size-[14px]" /> Net profit · {marginPct} margin</span>
      </div>
      <div className="pnl-rows">
        <div className="pnl-row"><span>Revenue (paid invoices)</span><strong className="pos mono">+{gbp0(toMoney(data.revenue))}</strong></div>
        <div className="pnl-costs">
          {costs.map((c, i) => <div key={i} className="pnl-row"><span>{c.label}</span><strong className="neg mono">{gbp0(c.val)}</strong></div>)}
        </div>
        <div className="pnl-row total"><span>Total costs</span><strong className="neg mono">{gbp0(-toMoney(data.totalCosts))}</strong></div>
      </div>
      <div className="pnl-margin">
        <div className="pnl-margin-head"><span>Margin</span><span>{marginPct}</span></div>
        <div className="pnl-bar"><span style={{ width: `${Math.max(0, Math.min(100, parseFloat(data.margin) * 100))}%` }} /></div>
      </div>
    </div>
  );
}

function CreditCardCard({ go }: { go: (v: string) => void }) {
  const { data: alerts } = useCreditAlerts();
  const list = alerts ?? [];
  return (
    <div className="card pad acard">
      <CardHead title="Credit Alerts" sub={`${list.length} client${list.length === 1 ? '' : 's'} flagged`} icon={ShieldAlert} tint="warn" />
      <div className="credit-list">
        {list.map((c) => (
          <div key={c.clientId} className="credit-row">
            <div className="credit-meta"><span className="credit-name">{c.clientName}</span><span className="credit-sub">{c.scoreChange < 0 ? `Score down ${Math.abs(c.scoreChange)} pts` : 'Low credit score'}</span></div>
            <span className="credit-score">{c.currentScore}</span>
          </div>
        ))}
        {list.length === 0 && <p className="ac-sub">No credit alerts — all clients above 55.</p>}
      </div>
      <button className="btn b-ghost b-block" onClick={() => go('clients')}><ExternalLink className="size-[15px]" /> View All Clients</button>
    </div>
  );
}

function NotificationsCard() {
  const { data } = useNotifications({ limit: 7 });
  const list = data?.notifications ?? [];
  return (
    <div className="card pad acard">
      <CardHead title="Notifications" sub={`${data?.total ?? 0} total`} />
      {list.length === 0 ? (
        <div className="notif-empty">
          <span className="notif-bell"><Bell className="size-6" /></span>
          <strong>All caught up</strong>
          <p>New alerts about overdue invoices, credit drops, and payments will appear here.</p>
        </div>
      ) : (
        <div className="notif-list">
          {list.map((n) => (
            <div key={n.id} className="notif-row">
              <span className={'notif-dot ' + (n.severity ?? 'info')} />
              <div className="notif-meta"><span className="notif-title">{n.title}</span><span className="notif-msg">{n.message}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TasksCard({ go }: { go: (v: string) => void }) {
  const { data: stats } = useTaskStats();
  const rows = [
    { label: 'In Progress', icon: Clock, count: stats?.inProgress ?? 0, color: 'var(--info)' },
    { label: 'On Hold', icon: CirclePause, count: stats?.onHold ?? 0, color: 'var(--warning)' },
    { label: 'Completed Today', icon: CircleCheck, count: stats?.completedToday ?? 0, color: 'var(--positive)' },
    { label: 'Overdue', icon: TriangleAlert, count: stats?.overdue ?? 0, color: 'var(--negative)' },
  ];
  return (
    <div className="card pad acard">
      <CardHead title="Tasks" sub={`${stats?.total ?? 0} total`} icon={SquareCheckBig} />
      <div className="tasks-list">
        {rows.map((t) => (
          <div key={t.label} className="task-row">
            <span className="task-ic" style={{ color: t.color, background: `color-mix(in srgb, ${t.color} 14%, white)` }}><t.icon className="size-[17px]" /></span>
            <span className="task-label">{t.label}</span>
            <span className={'task-count' + (t.label === 'Overdue' && t.count > 0 ? ' neg' : '')}>{t.count}</span>
          </div>
        ))}
      </div>
      <button className="btn b-ghost b-block" onClick={() => go('tasks')}><ExternalLink className="size-[15px]" /> View All Tasks</button>
    </div>
  );
}

function RecentInvoicesCard({ invoices }: { invoices: InvoiceSummary[] }) {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const statusKind = (s: string) => (s === 'paid' ? 'soft' : s === 'overdue' ? 'neg solid' : 'gray');
  return (
    <div className="card pad acard">
      <CardHead title="Recent Invoices" sub="Latest billing activity" />
      <div className="table-scroll">
        <table className="atable">
          <thead><tr><th>Invoice</th><th>Client</th><th>Status</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {invoices.slice(0, 5).map((iv) => (
              <tr key={iv.id}>
                <td><span className="ri-id">{iv.invoiceNumber}</span><br /><span className="ri-date">{fmtDate(iv.createdAt)}</span></td>
                <td className="ri-client">{iv.clientName}</td>
                <td><span className={'pill p-' + statusKind(iv.status)} style={{ textTransform: 'capitalize' }}>{iv.status}{iv.daysOverdue > 0 ? ` (${iv.daysOverdue}d)` : ''}</span></td>
                <td className="r mono ri-amt">{new Intl.NumberFormat('en-GB', { style: 'currency', currency: iv.currency }).format(toMoney(iv.total))}</td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--fg2)', padding: 24 }}>No recent invoices.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentActivityCard() {
  const { data } = useRecentActivity(5);
  const items = data ?? [];
  const rel = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${Math.max(mins, 1)}m ago`;
    const h = Math.round(mins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  };
  return (
    <div className="card pad acard">
      <CardHead title="Recent Activity" sub="Latest actions across the system" />
      <div className="act-list">
        {items.map((a) => (
          <div key={a.id} className="act-row">
            <span className="act-ic"><FileText className="size-4" /></span>
            <div className="act-meta"><span className="act-sys">{a.user}</span><span className="act-text">{a.action}</span></div>
            <span className="act-time">{rel(a.timestamp)}</span>
          </div>
        ))}
        {items.length === 0 && <p className="ac-sub">No recent activity yet.</p>}
      </div>
    </div>
  );
}

function TargetsCard() {
  const rows = [
    { label: 'Revenue', val: '£104k / £120k', pct: 87 },
    { label: 'Qualified leads', val: '1,640 / 2,000', pct: 82 },
    { label: 'New clients', val: '2 / 3', pct: 67 },
  ];
  return (
    <div className="card pad acard">
      <div className="ac-head">
        <div><h3 className="statto-title">Monthly Targets</h3><p className="ac-sub">Progress toward this month's goals</p></div>
        <span className="mock-flag" title="Targets are illustrative — no backend source yet">sample</span>
      </div>
      <div className="tgt-list">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="tgt-row"><span>{r.label}</span><strong className="mono">{r.val}</strong></div>
            <div className="pnl-bar"><span style={{ width: `${r.pct}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── Layout editor ───────────
const DEFAULT_ORDER = ['kpis', 'mini', 'revleads', 'campinv', 'bank', 'pnl', 'tasks'];
const CATALOG = ['kpis', 'mini', 'revleads', 'campinv', 'bank', 'pnl', 'tasks', 'targets'];
const LAYOUT_KEY = 'stato-admin-layout-v2';
const BLOCK_TITLES: Record<string, string> = {
  kpis: 'Key metrics', mini: 'Financial summary', revleads: 'Revenue & leads',
  campinv: 'Campaign & invoice status', bank: 'Banking & VAT', pnl: 'P&L, credit & notifications',
  tasks: 'Tasks, invoices & activity', targets: 'Monthly Targets',
};

const pieFieldForWindow = (c: CampaignSummary, w: DashboardWindow): number => {
  switch (w) {
    case 'this_week': return c.leadsThisWeek ?? 0;
    case 'this_month': return c.leadsThisMonth ?? 0;
    case 'last_month': return c.leadsLastMonth ?? 0;
    default: return c.totalLeads ?? 0;
  }
};

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leadsWindow, setLeadsWindow] = useState<DashboardWindow>('last_year');
  const [rangeOpen, setRangeOpen] = useState(false);
  const { data: stats, isLoading } = useDashboardStats({ window: leadsWindow });
  const { data: financialOverview } = useFinancialOverview({ window: leadsWindow });
  const { data: campaignsData } = useCampaigns({ limit: 100 });
  const { data: leadsByDay } = useLeadsByDay(7);

  // route a design view-slug to a real admin route
  const go = (v: string) => navigate(v === 'invoices' ? '/finance/invoices' : `/${v}`);

  // edit state
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? 'null');
      if (Array.isArray(s) && s.length) return s.filter((id: string) => BLOCK_TITLES[id]);
    } catch { /* ignore */ }
    return DEFAULT_ORDER;
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const hidden = CATALOG.filter((id) => !order.includes(id));
  const isDefault = JSON.stringify(order) === JSON.stringify(DEFAULT_ORDER);
  const save = () => { localStorage.setItem(LAYOUT_KEY, JSON.stringify(order)); setEditing(false); setAddOpen(false); };
  const resetLayout = () => { setOrder(DEFAULT_ORDER); localStorage.removeItem(LAYOUT_KEY); };
  const removeBlock = (id: string) => setOrder((o) => o.filter((x) => x !== id));
  const addBlock = (id: string) => { setOrder((o) => [...o, id]); setAddOpen(false); };
  const moveBlock = (i: number, dir: number) => setOrder((o) => {
    const j = i + dir; if (j < 0 || j >= o.length) return o;
    const next = [...o]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const onDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const next = [...order]; const [m] = next.splice(dragIdx, 1); next.splice(i, 0, m);
    setOrder(next); setDragIdx(null); setOverIdx(null);
  };

  const revRows = financialOverview && financialOverview.length > 0 ? financialOverview : [];
  const donutSegments = useMemo(() => {
    const byVertical = (campaignsData?.campaigns ?? []).reduce<Record<string, number>>((acc, c) => {
      const v = c.vertical || 'Other'; acc[v] = (acc[v] ?? 0) + pieFieldForWindow(c, leadsWindow); return acc;
    }, {});
    const total = Object.values(byVertical).reduce((s, n) => s + n, 0);
    if (total === 0) return [{ name: 'No data', pct: 100, color: 'var(--gray-300)' }];
    const ranked = Object.entries(byVertical).filter(([, n]) => n > 0).sort(([, a], [, b]) => b - a)
      .map(([name, n]) => ({ name, pct: Math.round((n / total) * 1000) / 10 }));
    const top = ranked.slice(0, 5).map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }));
    const restPct = ranked.slice(5).reduce((s, x) => s + x.pct, 0);
    return restPct > 0 ? [...top, { name: 'Others', pct: Math.round(restPct * 10) / 10, color: 'var(--gray-300)' }] : top;
  }, [campaignsData, leadsWindow]);

  if (!user) return null;

  const windowLabel = DASHBOARD_WINDOW_OPTIONS.find((o) => o.value === leadsWindow)?.label ?? 'Last 12 months';

  const KPIS = stats ? [
    { icon: PoundSterling, value: gbp0(stats.totalRevenue), label: `Revenue — ${stats.leadsWindowLabel ?? windowLabel}`, delta: stats.revenueChange != null ? `${formatPercentCapped(stats.revenueChange, { showSign: true })} vs prior period` : null, deltaKind: (stats.revenueChange ?? 0) >= 0 ? 'pos' : 'neg' },
    { icon: Users, value: String(stats.activeClients), label: 'Active Clients', delta: stats.clientChange != null ? `${stats.clientChange >= 0 ? '+' : ''}${stats.clientChange} vs prior period` : null, deltaKind: (stats.clientChange ?? 0) >= 0 ? 'pos' : 'neg' },
    { icon: TrendingUp, value: `${stats.linkedCampaigns ?? '–'} / ${stats.activeCampaigns}`, label: 'Campaigns (linked / active)', delta: stats.campaignChange != null ? `${stats.campaignChange >= 0 ? '+' : ''}${stats.campaignChange} vs prior period` : null, deltaKind: (stats.campaignChange ?? 0) >= 0 ? 'pos' : 'neg' },
    { icon: Activity, value: stats.totalLeadsThisMonth.toLocaleString(), label: `Leads — ${stats.leadsWindowLabel ?? windowLabel}`, delta: stats.leadsChange != null ? `${formatPercentCapped(stats.leadsChange, { showSign: true })} vs prior period` : null, deltaKind: (stats.leadsChange ?? 0) >= 0 ? 'pos' : 'neg' },
  ] : [];

  const MINI = stats ? [
    { icon: CreditCard, value: gbp0(stats.totalCost), label: `Ad Spend — ${stats.leadsWindowLabel ?? windowLabel}`, note: 'Catchr — Google + FB + TikTok', noteKind: '' },
    { icon: TrendingUp, value: gbp0(stats.netProfit), label: 'Net Profit — rolling 12mo / 90d', note: `${formatPercentCapped(stats.profitMargin)} margin · period-coherent`, noteKind: stats.netProfit >= 0 ? 'pos' : '' },
    { icon: Activity, value: formatPercentCapped(stats.profitMargin), label: 'Margin — rolling 12mo / 90d', note: stats.profitMargin >= 30 ? 'healthy' : stats.profitMargin >= 0 ? 'review' : 'loss-making', noteKind: '' },
  ] : [];

  const blocks: Record<string, React.ReactNode> = {
    kpis: <div className="kpi-row">{KPIS.map((k, i) => (
      <div key={i} className="kpi">
        <div className="kpi-top"><span className="kpi-ic"><k.icon className="size-5" /></span>{k.delta && <span className={'kpi-delta ' + k.deltaKind}><ArrowUpRight className="size-[13px]" strokeWidth={2.4} />{k.delta}</span>}</div>
        <div className="kpi-val mono">{k.value}</div><div className="kpi-lab">{k.label}</div>
      </div>
    ))}</div>,
    mini: <div className="mini-row">{MINI.map((m, i) => (
      <div key={i} className="kpi">
        <div className="kpi-top"><span className="kpi-ic"><m.icon className="size-5" /></span><span className={'kpi-note' + (m.noteKind === 'pos' ? ' pos' : '')}>{m.noteKind === 'pos' && <TrendingUp className="size-[13px]" strokeWidth={2.4} />}{m.note}</span></div>
        <div className="kpi-val mono">{m.value}</div><div className="kpi-lab">{m.label}</div>
      </div>
    ))}</div>,
    revleads: (
      <div className="grid-2-1">
        <div className="card pad acard">
          <CardHead title="Revenue Overview" sub={`Monthly revenue (Xero) vs ad spend (Catchr) — ${windowLabel}.`} />
          <div className="rev-legend"><span className="rl"><span className="rl-dot" style={{ background: 'var(--statto-ink)' }} /> Revenue</span><span className="rl"><span className="rl-dot" style={{ background: 'var(--lime-500)' }} /> Ad spend</span></div>
          {revRows.length > 0 ? <RevenueChart rows={revRows} /> : <p className="ac-sub">No revenue data for this period.</p>}
        </div>
        <div className="card pad acard">
          <CardHead title="Leads This Week" sub="Daily lead volume" />
          <LeadsWeek points={(leadsByDay ?? []).map((p) => ({ day: p.day, leads: p.leads }))} />
        </div>
      </div>
    ),
    campinv: (
      <div className="grid-1-2">
        <div className="card pad acard"><CardHead title="Campaign Sources" sub={`Lead distribution by channel — ${windowLabel}`} /><Donut segments={donutSegments} /></div>
        <div className="card pad acard"><CardHead title="Invoice Status" sub={`Monthly breakdown by payment status — ${windowLabel}. Click a chip to filter.`} />{revRows.length > 0 ? <InvoiceStatus rows={revRows} /> : <p className="ac-sub">No invoice data for this period.</p>}</div>
      </div>
    ),
    bank: <div className="grid-3"><BankCard /><InvoicesOwedCard go={go} /><VatCard /></div>,
    pnl: <div className="grid-3 align-start"><PnlCard /><CreditCardCard go={go} /><NotificationsCard /></div>,
    tasks: <div className="grid-3 align-start"><TasksCard go={go} /><RecentInvoicesCard invoices={stats?.recentInvoices ?? []} /><RecentActivityCard /></div>,
    targets: <TargetsCard />,
  };

  return (
    <>
      <div className="ahead">
        <div>
          <h1 className="ahead-title">Dashboard</h1>
          <p className="ahead-sub">Welcome back, {user.name}</p>
        </div>
        <div className="ahead-actions">
          {!editing ? (
            <>
              <button className="btn b-ghost b-sm" onClick={() => setEditing(true)}><Pencil className="size-[15px]" /> Edit layout</button>
              <div className="ahead-range">
                <span className="ahead-range-lab">Time range:</span>
                <div className="range-dd">
                  <button className="dd" onClick={() => setRangeOpen((o) => !o)}>{windowLabel} <ChevronDown className="size-[15px]" /></button>
                  {rangeOpen && (
                    <div className="range-menu">
                      {DASHBOARD_WINDOW_OPTIONS.map((r) => (
                        <button key={r.value} className={'range-opt' + (r.value === leadsWindow ? ' on' : '')} onClick={() => { setLeadsWindow(r.value); setRangeOpen(false); }}>{r.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="addcard-dd">
                <button className="btn b-ghost b-sm" onClick={() => setAddOpen((o) => !o)} disabled={!hidden.length}><Plus className="size-[15px]" /> Add card <ChevronDown className="size-[14px]" /></button>
                {addOpen && hidden.length > 0 && (
                  <div className="addcard-menu">
                    {hidden.map((id) => <button key={id} className="addcard-opt" onClick={() => addBlock(id)}><Plus className="size-[14px]" /> {BLOCK_TITLES[id]}</button>)}
                  </div>
                )}
              </div>
              <button className="btn b-ghost b-sm" onClick={resetLayout} disabled={isDefault} title="Restore the original arrangement"><RotateCcw className="size-[15px]" /> Reset</button>
              <button className="btn b-primary b-sm" onClick={save}><Check className="size-[15px]" /> Save</button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="edit-hint"><GripVertical className="size-4" /> Drag to rearrange, remove with ×, or add more from the <strong>Add card</strong> menu. Press <strong>Save</strong> when done.</div>
      )}

      {isLoading && !stats ? (
        <div className="kpi-row">{[0, 1, 2, 3].map((i) => <div key={i} className="kpi" style={{ opacity: 0.5 }}><div className="kpi-val mono">—</div><div className="kpi-lab">Loading…</div></div>)}</div>
      ) : (
        <div className="dash-blocks">
          {order.map((id, i) => (
            <section
              key={id}
              className={'dblock' + (editing ? ' editing' : '') + (dragIdx === i ? ' dragging' : '') + (overIdx === i && dragIdx !== null && dragIdx !== i ? ' over' : '')}
              draggable={editing}
              onDragStart={() => editing && setDragIdx(i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              onDragOver={(e) => { if (editing) { e.preventDefault(); if (i !== overIdx) setOverIdx(i); } }}
              onDrop={() => editing && onDrop(i)}
            >
              {editing && (
                <div className="dblock-bar">
                  <span className="dhandle"><GripVertical className="size-[13px]" /> {BLOCK_TITLES[id]}</span>
                  <button className="dremove" onClick={() => removeBlock(id)} title="Remove section"><X className="size-[15px]" /></button>
                </div>
              )}
              {editing && (
                <div className="dblock-move">
                  <button className="dmove-btn" disabled={i === 0} onClick={() => moveBlock(i, -1)} title="Move up"><ChevronUp className="size-[18px]" /></button>
                  <button className="dmove-btn" disabled={i === order.length - 1} onClick={() => moveBlock(i, 1)} title="Move down"><ChevronDown className="size-[18px]" /></button>
                </div>
              )}
              {blocks[id]}
            </section>
          ))}
          {editing && order.length === 0 && <div className="dash-empty">No sections. Use <strong>Add card</strong> to choose what to show.</div>}
        </div>
      )}
    </>
  );
}
