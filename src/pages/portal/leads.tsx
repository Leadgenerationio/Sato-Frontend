import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortalLeads } from '@/lib/hooks/use-portal';

function isoDay(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

const PRESETS: { label: string; from: () => string; to: () => string }[] = [
  { label: '7d', from: () => isoDay(-6), to: () => isoDay(0) },
  { label: '30d', from: () => isoDay(-29), to: () => isoDay(0) },
  { label: '90d', from: () => isoDay(-89), to: () => isoDay(0) },
  { label: 'YTD', from: () => `${new Date().getFullYear()}-01-01`, to: () => isoDay(0) },
];

export function PortalLeadsPage() {
  const [from, setFrom] = useState<string>(isoDay(-29));
  const [to, setTo] = useState<string>(isoDay(0));
  const { data, isLoading } = usePortalLeads({ from, to });
  const leads = data?.leads;

  const summary = useMemo(() => {
    if (!leads || leads.length === 0) return { total: 0, avg: 0, peak: 0 };
    const total = leads.reduce((s, d) => s + d.leadCount, 0);
    const peak = leads.reduce((m, d) => (d.leadCount > m ? d.leadCount : m), 0);
    return { total, avg: Math.round(total / leads.length), peak };
  }, [leads]);

  const chartData = useMemo(
    () =>
      (leads ?? [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({
          date: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          leads: d.leadCount,
        })),
    [leads],
  );

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setFrom(preset.from());
    setTo(preset.to());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lead Deliveries</h1>
        <p className="text-muted-foreground">Daily lead delivery breakdown for the selected date range</p>
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
              onChange={(e) => setFrom(e.target.value)}
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
              onChange={(e) => setTo(e.target.value)}
              className="w-full sm:w-[160px]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="outline"
                size="sm"
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
                    <Area type="monotone" dataKey="leads" stroke="#171717" fill="#171717" fillOpacity={0.15} name="Leads" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

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
                            <TableCell>{new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</TableCell>
                            <TableCell className="text-muted-foreground">{d.campaignName}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{d.leadCount}</TableCell>
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
        </>
      )}
    </div>
  );
}
