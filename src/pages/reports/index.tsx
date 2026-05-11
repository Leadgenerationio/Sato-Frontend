import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Megaphone, Users, Truck, Banknote, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const reports = [
  // Slice 4 — leadreports.io-style unified report. Pinned to the top so Sam
  // (and any staff) lands here by default; the older split reports stay live
  // until they're folded in Days 3-4.
  {
    href: '/reports/unified',
    title: 'Unified report',
    description: 'Revenue + cost + profit + margin in one place — one row per (campaign × supplier). Replaces the 5 split reports below.',
    icon: TrendingUp,
    isNew: true,
  },
  { href: '/reports/campaign', title: 'Campaign Performance', description: 'Leads, cost, revenue, CPL, profit, and margin per campaign', icon: Megaphone },
  { href: '/reports/client-pnl', title: 'Client P&L', description: 'Per-client monthly revenue, cost, and profit trends', icon: Users },
  { href: '/reports/supplier', title: 'Supplier Performance', description: 'CPL and volume by traffic source / supplier', icon: Truck },
  { href: '/reports/financial', title: 'Financial Overview', description: 'Monthly revenue, expenses, profit, invoices, and VAT', icon: Banknote },
  { href: '/reports/ad-spend', title: 'Ad Spend', description: 'Per-platform campaign spend synced hourly from Catchr (Google, Facebook, Bing, TikTok, Taboola)', icon: TrendingUp },
];

export function ReportsHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" description="Business performance analytics" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reports.map((r) => (
          <Link key={r.href} to={r.href}>
            <Card className={`h-full transition-colors cursor-pointer ${r.isNew ? 'border-emerald-500/40 hover:border-emerald-500' : 'hover:border-foreground/20'}`}>
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${r.isNew ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                    <r.icon className={`size-5 ${r.isNew ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{r.title}</h3>
                      {r.isNew && (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-xs">
                          <Sparkles className="size-3 mr-0.5" />New
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{r.description}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground mt-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
