// ─────────────────────────────────────────────────────────────────────────
// Dev-only mock API layer for the client portal.
//
// When VITE_BYPASS_AUTH=true (see .env.local) and there's no backend running,
// the portal endpoints are short-circuited here so every page renders with
// realistic data for design/testing. Hard-gated behind import.meta.env.DEV in
// api.ts, so this never ships in a production build.
//
// Shapes mirror src/lib/hooks/use-portal.ts exactly. Demo content echoes the
// design handoff (Benson Goldstein Ltd). Numbers are kept internally
// consistent (62 leads this month = bySource total = dashboard tile).
// ─────────────────────────────────────────────────────────────────────────

import type { ApiResponse } from '@/types';
import type {
  PortalDashboard, PortalInvoice, PortalLeadsResponse, PortalLeadDay,
  PortalCompliance, PortalCreativesBySection, PortalAgreement,
  CreativeApprovalState,
} from '@/lib/hooks/use-portal';

const CLIENT_NAME = 'Benson Goldstein Ltd';
const CAMPAIGN_ID = 'camp-spring-remortgage';
const CAMPAIGN_NAME = 'Spring Remortgage';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Last 14 calendar days, ending today — keeps the deliveries chart "recent".
function recentLeadDays(): { date: string; leads: number }[] {
  const pattern = [0, 0, 5, 19, 15, 25, 23, 20, 18, 9, 0, 0, 4, 7];
  const out: { date: string; leads: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ date: iso(d), leads: pattern[13 - i] ?? 0 });
  }
  return out;
}

const DASHBOARD: PortalDashboard = {
  companyName: CLIENT_NAME,
  clientType: 'managed',
  activeCampaigns: 1,
  totalLeadsThisMonth: 62,
  totalLeadsAllTime: 540,
  pendingInvoices: 1,
  overdueInvoices: 0,
  totalOutstanding: 1708.2,
  agreementSigned: true,
  recentLeads: recentLeadDays(),
  adSpendByPlatform: [
    { platform: 'facebook', spend: 2140, currency: 'GBP' },
    { platform: 'google', spend: 1890, currency: 'GBP' },
    { platform: 'instagram', spend: 790, currency: 'GBP' },
  ],
};

const INVOICES: PortalInvoice[] = [
  { id: 'inv-2041', invoiceNumber: 'INV-2041', status: 'sent', total: '1708.20', currency: 'GBP', dueDate: '2026-06-15', paidDate: null, daysOverdue: 0 },
  { id: 'inv-2018', invoiceNumber: 'INV-2018', status: 'paid', total: '1540.00', currency: 'GBP', dueDate: '2026-05-15', paidDate: '2026-05-12', daysOverdue: 0 },
  { id: 'inv-1994', invoiceNumber: 'INV-1994', status: 'paid', total: '1540.00', currency: 'GBP', dueDate: '2026-04-15', paidDate: '2026-04-11', daysOverdue: 0 },
  { id: 'inv-1971', invoiceNumber: 'INV-1971', status: 'paid', total: '1210.00', currency: 'GBP', dueDate: '2026-03-15', paidDate: '2026-03-13', daysOverdue: 0 },
];

// Daily lead rows for "this month". Valid totals 56, invalid 6 (→ Lead Quality
// card shows ~90% valid); bySource carries the headline 62 for the summary tile.
function leadDays(): PortalLeadDay[] {
  const rows: Array<[string, number, number]> = [
    ['2026-06-01', 9, 1], ['2026-06-02', 12, 1], ['2026-06-03', 8, 0],
    ['2026-06-04', 11, 2], ['2026-06-05', 6, 1], ['2026-06-06', 4, 0],
    ['2026-06-07', 3, 0], ['2026-06-08', 3, 1],
  ];
  return rows.map(([date, valid, invalid]) => ({
    date, campaignId: CAMPAIGN_ID, campaignName: CAMPAIGN_NAME,
    leadCount: valid + invalid, validLeads: valid, invalidLeads: invalid,
  }));
}

const LEADS_RESPONSE: PortalLeadsResponse = {
  leads: leadDays(),
  range: { from: '2026-06-01', to: '2026-06-08' },
  bySource: [
    { platform: 'facebook', leads: 36, spend: 2140, currency: 'GBP' },
    { platform: 'google', leads: 20, spend: 1890, currency: 'GBP' },
    { platform: 'instagram', leads: 6, spend: 790, currency: 'GBP' },
  ],
  bySourceWindow: { kind: 'preset', preset: 'this_month' },
  validLeadsByCampaign: { [CAMPAIGN_ID]: 62 },
};

const approval = (status: CreativeApprovalState['status'], by?: string, at?: string, feedback?: string): CreativeApprovalState => ({
  status, decidedAt: at ?? null, decidedByName: by ?? null, feedback: feedback ?? null,
});

const metrics = (spend: number, leads: number) => ({
  windowFrom: '2026-06-01', windowTo: '2026-06-08', spend, spendCurrency: 'GBP',
  validLeads: leads, costPerLead: leads ? Math.round(spend / leads) : null,
});

const COMPLIANCE: PortalCompliance[] = [
  {
    campaignName: CAMPAIGN_NAME,
    creatives: [
      { id: 'cr-1', name: 'Spring Remortgage — Static A', type: 'image', uploadedAt: '2026-05-28T09:00:00Z', fileUrl: 'creatives/static-a.jpg', signedUrl: null, approval: approval('approved', 'Coby Benson', '2026-05-29T10:00:00Z'), campaignMetrics: metrics(2140, 36) },
      { id: 'cr-2', name: 'Spring Remortgage — Static B', type: 'image', uploadedAt: '2026-05-30T09:00:00Z', fileUrl: 'creatives/static-b.jpg', signedUrl: null, approval: approval('pending'), campaignMetrics: metrics(1890, 20) },
      { id: 'cr-3', name: 'Remortgage Carousel', type: 'image', uploadedAt: '2026-06-02T09:00:00Z', fileUrl: 'creatives/carousel.jpg', signedUrl: null, approval: approval('changes_requested', 'Coby Benson', '2026-06-03T14:00:00Z', 'Please soften the headline copy.'), campaignMetrics: null },
    ],
    landingPages: [
      { id: 'lp-1', url: 'https://example.com/spring-remortgage', screenshotUrl: null, lastChecked: '2026-06-04T06:00:00Z' },
      { id: 'lp-2', url: 'https://example.com/remortgage-quote', screenshotUrl: null, lastChecked: '2026-06-04T06:00:00Z' },
    ],
  },
];

const CREATIVES: PortalCreativesBySection = {
  media: [
    { id: 'cr-1', campaignId: CAMPAIGN_ID, campaignName: CAMPAIGN_NAME, name: 'Spring Remortgage — Static A', type: 'image', fileUrl: 'creatives/static-a.jpg', r2Key: null, signedUrl: null, uploadedAt: '2026-05-28T09:00:00Z', section: 'media', approval: approval('approved', 'Coby Benson', '2026-05-29T10:00:00Z'), campaignMetrics: metrics(2140, 36) },
    { id: 'cr-4', campaignId: CAMPAIGN_ID, campaignName: CAMPAIGN_NAME, name: 'Search Headline Set', type: 'image', fileUrl: 'creatives/rsa.jpg', r2Key: null, signedUrl: null, uploadedAt: '2026-05-26T09:00:00Z', section: 'media', approval: approval('approved', 'Coby Benson', '2026-05-27T10:00:00Z'), campaignMetrics: metrics(1890, 20) },
  ],
  copyLp: [
    { id: 'cr-5', campaignId: CAMPAIGN_ID, campaignName: CAMPAIGN_NAME, name: 'Primary landing page', type: 'landing_page', fileUrl: 'https://example.com/spring-remortgage', r2Key: null, signedUrl: null, uploadedAt: '2026-05-26T09:00:00Z', section: 'copy_lp', approval: approval('approved', 'Coby Benson', '2026-05-27T10:00:00Z'), campaignMetrics: null },
  ],
};

const AGREEMENT: PortalAgreement = {
  id: 'agr-1',
  status: 'completed',
  signedAt: '2026-03-12T00:00:00Z',
  documentUrl: null,
  clientName: CLIENT_NAME,
  terms: 'Managed lead-generation service for Benson Goldstein Ltd.\n\n• Monthly retainer: £1,540.00\n• Cost per qualified lead: £420.00\n• Term: 12 months from 12 March 2026\n• Includes campaign management, creative production, and compliance screening (TPS/CTPS + GDPR consent capture).',
};

const ok = <T>(data: T): ApiResponse<T> => ({ status: 'success', data });

// ─────────────────────────────────────────────────────────────────────────
// ADMIN dashboard mock fixtures (Admin Dashboard.html demo data).
// ─────────────────────────────────────────────────────────────────────────
const isoDaysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const ADMIN_STATS = {
  totalRevenue: 1248563, revenueChange: 999,
  totalCost: 1069847, netProfit: 178716, profitMargin: 14.3,
  rollingRevenue365d: 1248563, rollingCost90d: 320000,
  activeClients: 5, activeCampaigns: 27, linkedCampaigns: 7,
  leadsThisMonth: 25207, leadsWindow: 'last_year', leadsWindowLabel: 'Last 12 months',
  leadsChange: null, asOf: isoDaysAgo(0),
};

const ADMIN_MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const ADMIN_REV_K = [120, 150, 110, 95, 100, 90, 105, 100, 115, 130, 300, 620];
const ADMIN_SPEND_K: (number | null)[] = [null, null, null, 40, 60, 55, 70, 80, 95, 120, 160, 210];
const ADMIN_INV = [
  [5, 1, 0], [13, 5, 0], [9, 2, 0], [8, 0, 0], [12, 0, 0], [5, 0, 0],
  [9, 0, 0], [10, 0, 0], [10, 0, 0], [12, 2, 0], [6, 5, 0], [0, 8, 0],
];
const ADMIN_FINANCIAL = ADMIN_MONTHS.map((m, i) => ({
  month: m,
  revenue: ADMIN_REV_K[i] * 1000,
  expenses: ADMIN_SPEND_K[i] == null ? null : (ADMIN_SPEND_K[i] as number) * 1000,
  profit: (ADMIN_REV_K[i] - (ADMIN_SPEND_K[i] ?? 0)) * 1000,
  invoicesPaid: ADMIN_INV[i][0], invoicesPending: ADMIN_INV[i][1], invoicesOverdue: ADMIN_INV[i][2],
  vatCollected: 0, isPartial: i === ADMIN_MONTHS.length - 1,
}));

const ADMIN_LEADS_WEEK = [
  { day: 'Mon', v: 232 }, { day: 'Tue', v: 222 }, { day: 'Wed', v: 165 },
  { day: 'Thu', v: 150 }, { day: 'Fri', v: 28 }, { day: 'Sat', v: 64 }, { day: 'Sun', v: 12 },
];
const ADMIN_LEADS_POINTS = ADMIN_LEADS_WEEK.map((d, i) => ({ day: d.day, date: isoDaysAgo(6 - i), leads: d.v }));

// Campaign verticals → totalLeads proportional to the design's source shares.
const ADMIN_SOURCES: [string, number][] = [
  ['Solar', 42.7], ['Hearing Aids', 19.1], ['Property Sales', 14.5], ['Insulation', 11.7],
  ['Legal — LPA', 5.8], ['Legal — Police Claims', 2.3], ['Will Writing', 2], ['PCP Claims', 1],
  ['Private Medical Insurance', 0.9],
];
const ADMIN_CAMPAIGNS = ADMIN_SOURCES.map(([vertical, pct], i) => {
  const totalLeads = Math.round(pct * 252);
  return {
    id: `camp-${i}`, name: `${vertical} Campaign`, clientName: 'Managed', clientNames: ['Managed'],
    vertical, status: 'active', campaignType: 'managed', leadPrice: 40, currency: 'GBP',
    totalLeads, leadsToday: Math.round(totalLeads / 90), leadsThisWeek: Math.round(totalLeads / 12),
    leadsThisMonth: Math.round(totalLeads / 3), leadsLastMonth: Math.round(totalLeads / 3),
  };
});

const mkInvoice = (invoiceNumber: string, clientName: string, status: string, total: string, daysAgo: number, daysOverdue = 0) => ({
  id: invoiceNumber, invoiceNumber, clientId: 'cl-1', clientName, status, currency: 'GBP',
  subtotal: total, vatAmount: '0', total, dueDate: isoDaysAgo(daysAgo - 14),
  paidDate: status === 'paid' ? isoDaysAgo(daysAgo - 2) : null, daysOverdue, createdAt: isoDaysAgo(daysAgo),
  xeroInvoiceId: null,
});
const ADMIN_RECENT_INVOICES = [
  mkInvoice('INV-0414', 'Copious Limited', 'authorised', '2250.00', 2),
  mkInvoice('INV-0413', 'UK Energy Saving Network', 'authorised', '48.00', 4),
  mkInvoice('INV-0411', 'Benson Goldstein Ltd', 'overdue', '1708.20', 6, 4),
  mkInvoice('INV-0410', 'UK Energy Saving Network', 'draft', '25032.00', 7),
  mkInvoice('INV-0404', 'Copious Limited', 'overdue', '3150.00', 7, 7),
];
const ADMIN_OUTSTANDING = [
  mkInvoice('INV-0413', 'UK Energy Saving Network', 'authorised', '48.00', 4),
  mkInvoice('INV-0414', 'Copious Limited', 'authorised', '2250.00', 2),
  mkInvoice('INV-0411', 'Benson Goldstein Ltd', 'overdue', '1708.20', 6, 4),
  mkInvoice('INV-0403', 'UK Energy Saving Network', 'overdue', '96.00', 9, 5),
];

const ADMIN_BANK = {
  configured: true,
  accounts: [
    { accountId: '1', name: 'Capital on Tap Account', code: null, currency: 'GBP', balance: '-22660.90', balanceDate: isoDaysAgo(2), unreconciledLines: null },
    { accountId: '2', name: 'CLINICAL MARKETING S', code: null, currency: 'GBP', balance: '79243.97', balanceDate: isoDaysAgo(2), unreconciledLines: null },
    { accountId: '3', name: 'Wise Currency', code: null, currency: 'USD', balance: '0.00', balanceDate: null, unreconciledLines: null },
    { accountId: '4', name: 'Mettle', code: null, currency: 'GBP', balance: '13.48', balanceDate: isoDaysAgo(2), unreconciledLines: null },
    { accountId: '5', name: 'CLINICAL MARKETING S#001', code: null, currency: 'GBP', balance: '140383.38', balanceDate: isoDaysAgo(2), unreconciledLines: null },
    { accountId: '6', name: 'Poodle', code: null, currency: 'GBP', balance: '-198.79', balanceDate: isoDaysAgo(2), unreconciledLines: null },
  ],
};
const ADMIN_VAT = { configured: true, currency: 'GBP', currentQuarter: { fromDate: isoDaysAgo(60), toDate: isoDaysAgo(0), owed: '0' } };
const ADMIN_PNL = {
  fromDate: isoDaysAgo(30), toDate: isoDaysAgo(0), currency: 'GBP',
  revenue: '1120770', fixedCosts: '97549', oneOffCosts: '0', advertisingCosts: '1257', adSpend: '120092',
  totalCosts: '218897', netProfit: '901872', margin: '0.805', uncategorisedCount: 105,
};
const ADMIN_CREDIT = [
  { clientId: 'cl-uesn', clientName: 'UK Energy Saving Network', scoreChange: -22, currentScore: 38 },
  { clientId: 'cl-apex', clientName: 'Apex Media Ltd', scoreChange: -18, currentScore: 38 },
];
const ADMIN_TASK_STATS = { total: 5, inProgress: 1, onHold: 1, completedToday: 0, overdue: 3 };
const ADMIN_ACTIVITY = [
  { id: 'a1', user: 'System', category: 'invoice', timestamp: isoDaysAgo(0), action: 'Invoice INV-0414 created for Copious Limited (£2,250)' },
  { id: 'a2', user: 'System', category: 'invoice', timestamp: isoDaysAgo(2), action: 'Invoice INV-0413 created for UK Energy Saving Network (£48)' },
  { id: 'a3', user: 'System', category: 'invoice', timestamp: isoDaysAgo(4), action: 'Invoice INV-0411 created for Benson Goldstein Ltd (£1,708)' },
  { id: 'a4', user: 'System', category: 'invoice', timestamp: isoDaysAgo(5), action: 'Invoice INV-0410 created for UK Energy Saving Network (£25,032)' },
  { id: 'a5', user: 'System', category: 'invoice', timestamp: isoDaysAgo(6), action: 'Invoice INV-0404 created for Copious Limited (£3,150)' },
];
const ADMIN_NOTIFICATIONS = {
  notifications: [
    { id: 'n1', type: 'invoice_overdue', title: 'Invoice overdue', message: 'INV-0411 (Benson Goldstein Ltd) is 4 days overdue.', read: false, createdAt: isoDaysAgo(0), severity: 'warning' as const, actionUrl: '/finance/invoices' },
    { id: 'n2', type: 'credit_drop', title: 'Credit score dropped', message: 'UK Energy Saving Network fell 22 points to 38.', read: false, createdAt: isoDaysAgo(1), severity: 'error' as const, actionUrl: '/clients' },
  ],
  total: 2, page: 1, pageSize: 7,
};

// Inline SVG placeholder so creative previews render something instead of a
// broken image when there's no R2 backend.
const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#F6F6F7"/><rect x="245" y="150" width="150" height="100" rx="12" fill="#9FE870"/><text x="320" y="290" font-family="Poppins,sans-serif" font-size="20" fill="#062F28" text-anchor="middle">Creative preview</text></svg>',
  );

// Returns a mock ApiResponse for a known portal/auth path, or null to let the
// request hit the network. Matches on pathname only (query string ignored).
export function getDevMock(method: string, path: string): ApiResponse<unknown> | null {
  const pathname = path.split('?')[0];
  const m = method.toUpperCase();

  if (m === 'GET') {
    switch (pathname) {
      case '/api/v1/portal/dashboard': return ok(DASHBOARD);
      case '/api/v1/portal/invoices': return ok({ invoices: INVOICES });
      case '/api/v1/portal/leads': return ok(LEADS_RESPONSE);
      case '/api/v1/portal/compliance': return ok({ compliance: COMPLIANCE });
      case '/api/v1/portal/creatives': return ok(CREATIVES);
      case '/api/v1/portal/agreement': return ok({ agreement: AGREEMENT });
      case '/api/v1/auth/me': return ok({ user: null }); // bypass already seeds the user
      // ── Admin dashboard ──
      case '/api/v1/dashboard/stats': return ok(ADMIN_STATS);
      case '/api/v1/reports/financial-overview': return ok({ report: ADMIN_FINANCIAL });
      case '/api/v1/dashboard/leads-by-day': return ok({ points: ADMIN_LEADS_POINTS });
      case '/api/v1/dashboard/recent-activity': return ok({ items: ADMIN_ACTIVITY });
      case '/api/v1/campaigns': return ok({ campaigns: ADMIN_CAMPAIGNS, total: ADMIN_CAMPAIGNS.length, page: 1, pageSize: 100 });
      case '/api/v1/invoices': return ok({ invoices: ADMIN_RECENT_INVOICES, total: ADMIN_RECENT_INVOICES.length });
      case '/api/v1/invoices/outstanding': return ok({ bucket: 'all', invoices: ADMIN_OUTSTANDING, count: ADMIN_OUTSTANDING.length, totalOutstanding: '128748.20' });
      case '/api/v1/integrations/xero/bank-accounts': return ok(ADMIN_BANK);
      case '/api/v1/integrations/xero/vat-liability': return ok(ADMIN_VAT);
      case '/api/v1/reports/pnl-summary': return ok(ADMIN_PNL);
      case '/api/v1/clients/credit-alerts': return ok({ alerts: ADMIN_CREDIT });
      case '/api/v1/tasks/stats': return ok({ stats: ADMIN_TASK_STATS });
      case '/api/v1/notifications': return ok(ADMIN_NOTIFICATIONS);
      default:
        if (/^\/api\/v1\/portal\/creatives\/[^/]+\/signed-url$/.test(pathname)) return ok({ url: PLACEHOLDER_IMG });
        break;
    }
  }

  // Buyer review actions + password change — pretend success so the UI flows.
  if (m === 'POST') {
    if (pathname === '/api/v1/auth/change-password') return ok({});
    if (/^\/api\/v1\/portal\/creatives\/[^/]+\/(approve|reject|request-changes)$/.test(pathname)) return ok({});
  }

  return null;
}
