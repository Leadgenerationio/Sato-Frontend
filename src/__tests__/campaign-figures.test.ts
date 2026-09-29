import { describe, it, expect } from 'vitest';
import { adAccountTotals, chartableSuppliers, isAttributed, suppliersWithoutLeads } from '@/lib/campaign-figures';
import type { CampaignSupplier, TrafficSource } from '@/lib/hooks/use-campaigns';

// Sam S11 (2026-09-29): Supplier CPL chart had no bars; Ad Account Links
// totals must not add "shared" zeros in as if they were real figures.

const sup = (over: Partial<CampaignSupplier>): CampaignSupplier => ({
  id: 'x', name: 'X', platform: 'x', totalSpend: 0, totalLeads: 0, cpl: null, ...over,
});

const src = (over: Partial<TrafficSource>): TrafficSource => ({
  id: 'r', campaignId: 'c', name: 'n', platform: 'facebook', accountId: 'a', catchrUrl: null,
  isActive: true, totalSpend: 0, totalLeads: 0, cpl: 0, revenue: 0, netProfit: 0, createdAt: '', ...over,
});

describe('chartableSuppliers', () => {
  it('draws only sources with leads and a cost, highest CPL first', () => {
    const rows = chartableSuppliers([
      sup({ name: 'Google', totalSpend: 100, totalLeads: 10, cpl: 10 }),
      sup({ name: 'Facebook', totalSpend: 14527.53, totalLeads: 190, cpl: 76.46 }),
      sup({ name: 'Taboola', totalSpend: 250, totalLeads: 0, cpl: null }),
      sup({ name: 'Affiliate', totalSpend: 0, totalLeads: 5, cpl: 0 }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Facebook', 'Google']);
  });

  it('lists spend-only sources separately', () => {
    expect(suppliersWithoutLeads([
      sup({ name: 'Taboola', totalSpend: 250, totalLeads: 0 }),
      sup({ name: 'Google', totalSpend: 100, totalLeads: 10, cpl: 10 }),
    ]).map((r) => r.name)).toEqual(['Taboola']);
  });
});

describe('adAccountTotals', () => {
  it('sums spend over every row but revenue/profit only over attributed rows', () => {
    const t = adAccountTotals([
      src({ totalSpend: 14527.53, totalLeads: 190, revenue: 13440, netProfit: -1087.53, attribution: 'platform' }),
      src({ totalSpend: 100, attribution: 'shared', netProfit: -100 }),
      src({ totalSpend: 50, attribution: 'shared', netProfit: -50 }),
    ]);
    expect(t).toEqual({ spend: 14677.53, revenue: 13440, profit: -1087.53, leads: 190, shared: 2, unavailable: false });
  });

  it('flags unavailable and treats rows from an older backend (no attribution) as attributed', () => {
    expect(isAttributed(src({}))).toBe(true);
    const t = adAccountTotals([src({ totalSpend: 5, attribution: 'unavailable' }), src({ totalSpend: 1, revenue: 3, netProfit: 2 })]);
    expect(t).toMatchObject({ spend: 6, revenue: 3, profit: 2, unavailable: true, shared: 0 });
  });
});
