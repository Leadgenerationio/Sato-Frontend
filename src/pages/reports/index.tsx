import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Megaphone, Users, Truck, Banknote, ArrowRight, TrendingUp } from 'lucide-react';

const reports = [
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
            <Card className="h-full hover:border-foreground/20 transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <r.icon className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold">{r.title}</h3>
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
