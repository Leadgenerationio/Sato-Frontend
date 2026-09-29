import type { CampaignSupplier, TrafficSource } from '@/lib/hooks/use-campaigns';

// Sam S11 (feedback round 1, 2026-09-29) — campaign page figures. The
// backend now merges "facebook" / "Facebook Ads" into one source, folds ad
// spend into each source's cost, and flags Ad Account Links rows whose leads
// and revenue can't be attributed to them. These helpers keep the page from
// drawing a £0 CPL bar or adding "shared" zeros into a total.

/** Sources that can be drawn as a CPL bar: they have leads and a cost. */
export function chartableSuppliers(suppliers: readonly CampaignSupplier[]): CampaignSupplier[] {
  return suppliers
    .filter((s) => s.cpl != null && s.totalLeads > 0 && s.totalSpend > 0)
    .sort((a, b) => (b.cpl ?? 0) - (a.cpl ?? 0));
}

/** Sources with spend but no leads recorded — listed under the chart, never
 *  drawn as a £0 bar. */
export function suppliersWithoutLeads(suppliers: readonly CampaignSupplier[]): CampaignSupplier[] {
  return suppliers.filter((s) => s.totalLeads === 0 && s.totalSpend > 0);
}

/** true when the row's leads / revenue / CPL / profit are its own figures.
 *  Rows from an older backend (no `attribution`) keep the old behaviour. */
export function isAttributed(row: Pick<TrafficSource, 'attribution'>): boolean {
  return row.attribution === undefined || row.attribution === 'platform';
}

export interface AdAccountTotals {
  spend: number;
  /** Sum over attributed rows only. */
  revenue: number;
  profit: number;
  leads: number;
  /** Rows whose leads/revenue can't be split from another row on the same platform. */
  shared: number;
  unavailable: boolean;
}

export function adAccountTotals(rows: readonly TrafficSource[]): AdAccountTotals {
  const t: AdAccountTotals = { spend: 0, revenue: 0, profit: 0, leads: 0, shared: 0, unavailable: false };
  for (const r of rows) {
    t.spend += r.totalSpend;
    if (isAttributed(r)) {
      t.revenue += r.revenue;
      t.leads += r.totalLeads;
      // Profit over attributed rows only, so "shared" spend isn't counted
      // against revenue that isn't in this total.
      t.profit += r.netProfit;
    } else if (r.attribution === 'shared') {
      t.shared += 1;
    } else {
      t.unavailable = true;
    }
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return { ...t, spend: round2(t.spend), revenue: round2(t.revenue), profit: round2(t.profit) };
}
