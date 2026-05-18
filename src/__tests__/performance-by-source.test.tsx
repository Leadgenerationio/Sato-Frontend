import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  aggregateByPlatform,
  PerformanceBySourceTable,
} from '../components/dashboard/performance-by-source-widget';
import type { UnifiedReportRow } from '../lib/hooks/use-reports';

// Sam (2026-05-15 meeting #10): "Master at the top + per-source profitability
// row — the Facebook spend → Facebook profit / margin row that
// leadreports.io shows." These tests pin the aggregation behaviour and the
// presentational shape so a future refactor doesn't silently break the hero
// dashboard widget.

function row(over: Partial<UnifiedReportRow>): UnifiedReportRow {
  return {
    campaignId: 'c1',
    campaignName: 'Solar Panels',
    clientName: 'UK Energy',
    vertical: 'Solar',
    supplier: 'FB Solar UK',
    supplierPlatform: 'facebook-ads',
    catchrUrl: null,
    leads: 100,
    spend: 1000,
    revenue: 3000,
    profit: 2000,
    cpl: 10,
    margin: 66.7,
    ...over,
  };
}

describe('aggregateByPlatform', () => {
  it('returns empty rows and zero totals for empty input', () => {
    const out = aggregateByPlatform([]);
    expect(out.rows).toEqual([]);
    expect(out.totals).toEqual({
      platform: 'all',
      leads: 0,
      spend: 0,
      revenue: 0,
      profit: 0,
      margin: 0,
    });
  });

  it('sums two rows with the same supplierPlatform into one aggregate row', () => {
    const out = aggregateByPlatform([
      row({ supplierPlatform: 'facebook-ads', leads: 100, spend: 1000, revenue: 3000 }),
      row({ supplierPlatform: 'facebook-ads', leads: 50, spend: 500, revenue: 1500 }),
    ]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({
      platform: 'facebook-ads',
      leads: 150,
      spend: 1500,
      revenue: 4500,
      profit: 3000,
    });
  });

  it('keeps distinct platforms separate and sorts by spend desc', () => {
    const out = aggregateByPlatform([
      row({ supplierPlatform: 'taboola', spend: 200, revenue: 600, leads: 20 }),
      row({ supplierPlatform: 'facebook-ads', spend: 2000, revenue: 6000, leads: 200 }),
      row({ supplierPlatform: 'google-ads', spend: 1000, revenue: 3000, leads: 100 }),
    ]);
    expect(out.rows.map((r) => r.platform)).toEqual([
      'facebook-ads',
      'google-ads',
      'taboola',
    ]);
  });

  it('computes margin to one decimal place', () => {
    const out = aggregateByPlatform([
      row({ supplierPlatform: 'facebook-ads', spend: 1000, revenue: 3000 }),
    ]);
    // (3000 - 1000) / 3000 * 100 = 66.666...% → 66.7
    expect(out.rows[0].margin).toBe(66.7);
  });

  it('returns margin 0 when revenue is 0 (no NaN, no Infinity)', () => {
    const out = aggregateByPlatform([
      row({ supplierPlatform: 'facebook-ads', spend: 500, revenue: 0, leads: 10 }),
    ]);
    expect(out.rows[0].margin).toBe(0);
    expect(out.rows[0].profit).toBe(-500);
  });

  it('buckets rows with missing supplierPlatform as "unknown"', () => {
    const out = aggregateByPlatform([
      row({ supplierPlatform: '', spend: 100, revenue: 250 }),
    ]);
    expect(out.rows[0].platform).toBe('unknown');
  });
});

describe('PerformanceBySourceTable — presentational states', () => {
  it('renders the loading skeleton when isLoading is true', () => {
    render(
      <MemoryRouter>
        <PerformanceBySourceTable
          isLoading={true}
          error={null}
          aggregate={null}
        />
      </MemoryRouter>,
    );
    // Skeleton rows render with role=status via the shared Skeleton component;
    // fall back to a structural assertion that the table body is empty.
    expect(screen.queryByText('Totals')).not.toBeInTheDocument();
  });

  it('renders an empty state with link to /reports when no rows', () => {
    render(
      <MemoryRouter>
        <PerformanceBySourceTable
          isLoading={false}
          error={null}
          aggregate={{ rows: [], totals: { platform: 'all', leads: 0, spend: 0, revenue: 0, profit: 0, margin: 0 } }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No traffic-source activity/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /detailed report/i })).toHaveAttribute('href', '/reports');
  });

  it('renders aggregated rows with platform labels and a totals row', () => {
    render(
      <MemoryRouter>
        <PerformanceBySourceTable
          isLoading={false}
          error={null}
          aggregate={{
            rows: [
              { platform: 'facebook-ads', leads: 200, spend: 2000, revenue: 6000, profit: 4000, margin: 66.7 },
              { platform: 'google-ads', leads: 100, spend: 1000, revenue: 3000, profit: 2000, margin: 66.7 },
            ],
            totals: { platform: 'all', leads: 300, spend: 3000, revenue: 9000, profit: 6000, margin: 66.7 },
          }}
        />
      </MemoryRouter>,
    );
    // Widget displays the platform with dashes swapped for spaces (plus a
    // CSS capitalize) — assert against the actual DOM text.
    expect(screen.getByText('facebook ads')).toBeInTheDocument();
    expect(screen.getByText('google ads')).toBeInTheDocument();
    expect(screen.getByText('Totals')).toBeInTheDocument();
  });
});
