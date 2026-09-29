// N5 (Sam feedback round 1, 29 Sep 2026): the five legacy report URLs used to
// redirect to /reports/unified with nothing to say which report you asked
// for. Each one now lands on the unified page with `?view=<id>`, which scrolls
// to the matching section and says in plain words where that report now lives.

export type ReportViewId = 'campaign' | 'supplier' | 'ad-spend' | 'client-pnl' | 'financial';

export interface ReportView {
  /** Legacy path segment under /reports/. */
  id: ReportViewId;
  /** data-testid of the section to scroll to, or null for the top of the page. */
  sectionTestId: string | null;
  /** Shown in a banner above the report. */
  note: string;
}

export const REPORT_VIEWS: Record<ReportViewId, ReportView> = {
  campaign: {
    id: 'campaign',
    sectionTestId: 'by-campaign-rollup',
    note: 'Campaign report: see "By campaign · roll-up" below.',
  },
  supplier: {
    id: 'supplier',
    sectionTestId: 'by-source-rollup',
    note: 'Supplier report: see "By source · profitability" below.',
  },
  'ad-spend': {
    id: 'ad-spend',
    sectionTestId: 'by-source-rollup',
    note: 'Ad spend report: spend per platform is in "By source · profitability" below, and per campaign in the Spend column.',
  },
  'client-pnl': {
    id: 'client-pnl',
    sectionTestId: 'report-main-table',
    note: 'There is no separate client P&L report. Filter this table by campaign and read the Client column, or open the client\'s page for its invoices.',
  },
  financial: {
    id: 'financial',
    sectionTestId: null,
    note: 'Financial summary: the Leads / Spend / Revenue / Profit / Margin totals are at the top of this report.',
  },
};

export const LEGACY_REPORT_PATHS = Object.keys(REPORT_VIEWS) as ReportViewId[];

export function resolveReportView(raw: string | null | undefined): ReportView | null {
  if (!raw) return null;
  return (REPORT_VIEWS as Record<string, ReportView>)[raw] ?? null;
}
