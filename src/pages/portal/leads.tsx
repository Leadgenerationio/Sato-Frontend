import { Fragment, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortalLeads } from '@/lib/hooks/use-portal';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import type { PortalLeadDay, PortalLeadsBySource } from '@/lib/hooks/use-portal';
import { platformLabel, formatMoney } from '@/lib/hooks/use-ad-spend';
import { cn } from '@/lib/utils';

// Sam (jam-video #3, 29-May-2026): timezone-safe ISO date formatter. The
// previous `.toISOString().split('T')[0]` path broke for BST/UK users on
// month-/week-start dates: `new Date(2026, 4, 1)` is "1 May 00:00 BST" =
// "30 Apr 23:00 UTC", which `.toISOString()` then rendered as 2026-04-30.
// That kicked the preset away from LeadByte's 'this_month' bucket and the
// By Source breakdown vanished — Sam saw "only visible in Today / Yesterday"
// because those are the only presets whose times aren't midnight-local.
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

// Sam (jam-video #2, 27-May-2026): "you can see the amount of leads that
// google or facebook has generated, and the ad spend next to it".
// Platform label + money formatting come from use-ad-spend.ts so the portal
// shows the same prettified names as the agency Ad Spend page (Hari PR #30).

function totalSpendByCurrency(rows: PortalLeadsBySource[]): Array<{ currency: string; total: number }> {
  const buckets = new Map<string, number>();
  for (const r of rows) {
    buckets.set(r.currency, (buckets.get(r.currency) ?? 0) + r.spend);
  }
  return Array.from(buckets.entries()).map(([currency, total]) => ({ currency, total }));
}

// Sam (jam-video #3, 29-May-2026): preset buttons must map 1:1 to LeadByte
// presets so the By Source breakdown is always available with real (valid)
// lead counts — no estimates. 7d/30d/90d don't map and produced "est."
// numbers Sam called "made up figures, non-negotiable." Replaced with the
// LeadByte preset set the admin /reports page already uses.
function firstOfMonth(year: number, month: number): string {
  // month is 0-indexed (Jan = 0). isoLocal avoids the UTC rollback bug.
  return isoLocal(new Date(year, month, 1));
}
function lastOfMonth(year: number, month: number): string {
  return isoLocal(new Date(year, month + 1, 0));
}
function startOfWeek(): string {
  const now = new Date();
  const dow = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon
  return isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow));
}

const PRESETS: { label: string; from: () => string; to: () => string }[] = [
  { label: 'Today', from: () => isoDay(0), to: () => isoDay(0) },
  { label: 'Yesterday', from: () => isoDay(-1), to: () => isoDay(-1) },
  { label: 'This week', from: () => startOfWeek(), to: () => isoDay(0) },
  {
    label: 'This month',
    from: () => { const n = new Date(); return firstOfMonth(n.getFullYear(), n.getMonth()); },
    to: () => isoDay(0),
  },
  {
    label: 'Last month',
    from: () => { const n = new Date(); return firstOfMonth(n.getFullYear(), n.getMonth() - 1); },
    to: () => { const n = new Date(); return lastOfMonth(n.getFullYear(), n.getMonth() - 1); },
  },
  { label: 'YTD', from: () => `${new Date().getFullYear()}-01-01`, to: () => isoDay(0) },
];

interface DeliveryGroup {
  campaignId: string;
  campaignName: string;
  totalLeads: number;
  validLeads: number;
  invalidLeads: number;
  firstDate: string;
  lastDate: string;
  activeDays: number;
  days: PortalLeadDay[];
}

function groupByDelivery(leads: PortalLeadDay[]): DeliveryGroup[] {
  const map = new Map<string, DeliveryGroup>();
  for (const row of leads) {
    const key = row.campaignId;
    const existing = map.get(key);
    if (existing) {
      existing.totalLeads += row.leadCount;
      existing.validLeads += row.validLeads;
      existing.invalidLeads += row.invalidLeads;
      if (row.date < existing.firstDate) existing.firstDate = row.date;
      if (row.date > existing.lastDate) existing.lastDate = row.date;
      existing.activeDays += 1;
      existing.days.push(row);
    } else {
      map.set(key, {
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        totalLeads: row.leadCount,
        validLeads: row.validLeads,
        invalidLeads: row.invalidLeads,
        firstDate: row.date,
        lastDate: row.date,
        activeDays: 1,
        days: [row],
      });
    }
  }
  // Sam (jam-video #3, 29-May-2026): admin /reports/campaign shows VALID
  // leads, not total — sort by validLeads so the campaign table matches.
  return Array.from(map.values())
    .map((g) => ({ ...g, days: g.days.slice().sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.validLeads - a.validLeads);
}

export function PortalLeadsPage() {
  usePageTitle('Stato — Leads');
  // Sam (jam-video #3): default to "This month" — maps to the LeadByte
  // preset so the By Source breakdown is populated on first load. Derive the
  // initial range AND highlighted chip from one preset so they can't desync.
  const DEFAULT_PRESET = PRESETS.find((p) => p.label === 'This month')!;
  const [from, setFrom] = useState<string>(DEFAULT_PRESET.from());
  const [to, setTo] = useState<string>(DEFAULT_PRESET.to());
  // Track the explicitly-selected preset by label, not by range-equality:
  // "This week" and "This month" produce an identical range when the month
  // starts on a Monday, so range matching would light up both. null = custom.
  const [activePreset, setActivePreset] = useState<string | null>(DEFAULT_PRESET.label);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data, isLoading } = usePortalLeads({ from, to });
  const leads = data?.leads;
  const bySource = data?.bySource ?? [];
  const bySourceWindow = data?.bySourceWindow;
  // Yash (30-May-2026): when the preset window matches, the BE returns the
  // per-campaign valid-lead count derived from LeadByte's per-supplier truth
  // (Catchr-mapped suppliers only). FE applies this as an override on the
  // By Campaign table so the row count matches the summary tile (110) and
  // not lead_deliveries.lead_count (144 — includes Direct / unmapped).
  const validLeadsByCampaign = data?.validLeadsByCampaign;

  // Sam (jam-video #3, 29-May-2026): "Google's on 18 valid leads and
  // Facebook's on 92 valid leads, so it's 110 but 141, you've got the
  // figures well off." Admin /reports reads valid leads from LeadByte's
  // per-supplier report — that's what bySource carries on preset ranges.
  // Sum that for Total Leads so the portal matches admin to the lead.
  // For custom (non-preset) ranges fall back to lead_deliveries.validLeads
  // — the breakdown isn't available there anyway so the discrepancy is
  // transparent to the user.
  const summary = useMemo(() => {
    // `leads` has one row per (campaign × day), so leads.length over-counts the
    // denominator for multi-campaign clients (a day with 3 campaigns = 3 rows).
    // "Avg / Day" must divide by DISTINCT calendar days, not row count.
    const distinctDays = new Set((leads ?? []).map((d) => d.date)).size;
    if (bySource.length > 0) {
      const total = bySource.reduce((s, r) => s + r.leads, 0);
      const peak = leads ? leads.reduce((m, d) => (d.validLeads > m ? d.validLeads : m), 0) : 0;
      return { total, avg: distinctDays > 0 ? Math.round(total / distinctDays) : 0, peak };
    }
    if (!leads || leads.length === 0) return { total: 0, avg: 0, peak: 0 };
    const total = leads.reduce((s, d) => s + d.validLeads, 0);
    const peak = leads.reduce((m, d) => (d.validLeads > m ? d.validLeads : m), 0);
    return { total, avg: distinctDays > 0 ? Math.round(total / distinctDays) : 0, peak };
  }, [leads, bySource]);

  const chartData = useMemo(
    () =>
      (leads ?? [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({ date: formatDayShort(d.date), leads: d.validLeads })),
    [leads],
  );

  const deliveries = useMemo(() => {
    const groups = groupByDelivery(leads ?? []);
    if (!validLeadsByCampaign) return groups;
    // Override per-row validLeads with LeadByte truth when available so the
    // By Campaign table matches the summary tile. Re-sort because the
    // override can change the rank order.
    return groups
      .map((g) => {
        const override = validLeadsByCampaign[g.campaignId];
        return override != null ? { ...g, validLeads: override } : g;
      })
      .sort((a, b) => b.validLeads - a.validLeads);
  }, [leads, validLeadsByCampaign]);

  const toggleExpanded = (campaignId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setFrom(preset.from());
    setTo(preset.to());
    setActivePreset(preset.label);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-muted-foreground">Lead breakdown by campaign for the selected date range</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date range</CardTitle>
          <CardDescription>Pick a preset or set a custom period</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="from-date">From</Label>
            <Input
              id="from-date"
              type="date"
              value={from}
              max={to}
              onChange={(e) => { setFrom(e.target.value); setActivePreset(null); }}
              className="w-full sm:w-[160px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to-date">To</Label>
            <Input
              id="to-date"
              type="date"
              value={to}
              min={from}
              max={isoDay(0)}
              onChange={(e) => { setTo(e.target.value); setActivePreset(null); }}
              className="w-full sm:w-[160px]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant={activePreset === p.label ? 'default' : 'outline'}
                size="sm"
                // The default (active) variant has no border; the outline
                // variant does. Add a transparent border so the active chip
                // keeps the same box and doesn't visibly shrink on click.
                className={activePreset === p.label ? 'border border-transparent' : undefined}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="gap-3 py-5"><CardContent className="text-center"><p className="text-2xl font-bold">{summary.total}</p><p className="text-sm text-muted-foreground">Total Leads</p></CardContent></Card>
            <Card className="gap-3 py-5"><CardContent className="text-center"><p className="text-2xl font-bold">{summary.avg}</p><p className="text-sm text-muted-foreground">Avg / Day</p></CardContent></Card>
            <Card className="gap-3 py-5"><CardContent className="text-center"><p className="text-2xl font-bold">{summary.peak}</p><p className="text-sm text-muted-foreground">Peak Day</p></CardContent></Card>
          </div>

          {bySourceWindow?.kind === 'custom-no-preset-match' ? (
            <Card>
              <CardHeader>
                <CardTitle>By Source</CardTitle>
                <CardDescription>
                  Per-source breakdown uses the LeadByte report, which only supports the
                  presets below. Pick one to see Facebook / Google / etc. lead counts and
                  spend.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <Button key={p.label} type="button" variant={activePreset === p.label ? 'default' : 'outline'} size="sm" className={activePreset === p.label ? 'border border-transparent' : undefined} onClick={() => applyPreset(p)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : bySource.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>By Source</CardTitle>
                <CardDescription>
                  Valid leads from LeadByte and ad spend from Catchr — same numbers as
                  the admin <span className="font-medium">/reports</span> campaign view.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Ad spend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bySource.map((row) => (
                      <TableRow key={`${row.platform}-${row.currency}`}>
                        <TableCell className="font-medium">{platformLabel(row.platform)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.leads.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatMoney(row.spend, row.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {totalSpendByCurrency(bySource).map(({ currency, total }, idx) => (
                      <TableRow key={`total-${currency}`} className="border-t-2 bg-muted/30">
                        <TableCell className="font-semibold">Total</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {/* Leads aren't currency-bound — show the grand total
                              once (on the first currency row) so a multi-currency
                              client doesn't see the lead count repeated per row. */}
                          {idx === 0 ? summary.total.toLocaleString() : ''}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatMoney(total, currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Daily Volume</CardTitle><CardDescription>Leads delivered per day</CardDescription></CardHeader>
            <CardContent>
              <div className="h-[200px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip />
                    <Area type="monotone" dataKey="leads" stroke="#062F28" fill="#062F28" fillOpacity={0.15} name="Leads" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="by-campaign" className="space-y-4">
            <TabsList>
              <TabsTrigger value="by-campaign">By Campaign</TabsTrigger>
              <TabsTrigger value="daily">Daily</TabsTrigger>
            </TabsList>

            <TabsContent value="by-campaign">
              <Card>
                <CardHeader>
                  <CardTitle>By Campaign</CardTitle>
                  <CardDescription>Lead counts grouped per campaign — click a row to see the daily breakdown</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8" />
                            <TableHead>Campaign</TableHead>
                            <TableHead>Date Range</TableHead>
                            <TableHead className="text-right">Days</TableHead>
                            <TableHead className="text-right">Leads</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deliveries.length > 0 ? (
                            deliveries.map((d) => {
                              const isExpanded = expanded.has(d.campaignId);
                              return (
                                <Fragment key={d.campaignId}>
                                  <TableRow
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => toggleExpanded(d.campaignId)}
                                  >
                                    <TableCell>
                                      <ChevronRight
                                        className={cn(
                                          'size-4 text-muted-foreground transition-transform',
                                          isExpanded && 'rotate-90',
                                        )}
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium">{d.campaignName}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {d.firstDate === d.lastDate
                                        ? formatDayShort(d.firstDate)
                                        : `${formatDayShort(d.firstDate)} – ${formatDayShort(d.lastDate)}`}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                      {d.activeDays}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-medium">
                                      {d.validLeads}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={5} className="bg-muted/30 p-0">
                                        <div className="px-6 py-3">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="text-right">Valid</TableHead>
                                                <TableHead className="text-right">Invalid</TableHead>
                                                <TableHead className="text-right">Leads</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {d.days.map((day, i) => (
                                                <TableRow key={i} className="hover:bg-transparent">
                                                  <TableCell>{formatDayShort(day.date)}</TableCell>
                                                  <TableCell className="text-right tabular-nums text-muted-foreground">{day.validLeads}</TableCell>
                                                  <TableCell className="text-right tabular-nums text-muted-foreground">{day.invalidLeads}</TableCell>
                                                  <TableCell className="text-right tabular-nums">{day.leadCount}</TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </Fragment>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                                No leads in this date range.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="daily">
              <Card>
                <CardHeader><CardTitle>Daily Breakdown</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[400px] overflow-y-auto">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Campaign</TableHead>
                            <TableHead className="text-right">Leads</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leads && leads.length > 0 ? (
                            leads.map((d, i) => (
                              <TableRow key={i}>
                                <TableCell>{formatDayShort(d.date)}</TableCell>
                                <TableCell className="text-muted-foreground">{d.campaignName}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">{d.validLeads}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                                No leads in this date range.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
