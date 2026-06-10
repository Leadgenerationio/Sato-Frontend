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
const mkInvoice =(invoiceNumber: string, clientName: string, status: string, total: string, daysAgo: number, daysOverdue = 0) => ({
  id: invoiceNumber, invoiceNumber, clientId: 'cl-1', clientName, status, currency: 'GBP',
  subtotal: total, vatAmount: '0', total, dueDate: isoDaysAgo(daysAgo - 14),
  paidDate: status === 'paid' ? isoDaysAgo(daysAgo - 2) : null, daysOverdue, createdAt: isoDaysAgo(daysAgo),
  xeroInvoiceId: null,
});
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

// ─────────────────────────────────────────────────────────────────────────
// ADMIN list-page mock fixtures (clients, campaigns, finance, HR, SOPs, SOS,
// tasks, workflows, agreements, reports, integrations). Shapes mirror the
// hooks in src/lib/hooks/ exactly so unwrap() + the consuming pages render
// fully against canned demo data with no backend running.
// ─────────────────────────────────────────────────────────────────────────

// ── Clients (use-clients → PaginatedClients) ──
const ADMIN_CLIENTS = [
  { id: 'cl-bgl', companyName: 'Benson Goldstein Ltd', contactName: 'Coby Benson', contactEmail: 'coby@bensongoldstein.co.uk', status: 'active', currency: 'GBP', creditScore: 82, activeCampaigns: 2, totalRevenue: 41280, createdAt: isoDaysAgo(420), agreementSigned: true, documentsCount: 4 },
  { id: 'cl-uesn', companyName: 'UK Energy Saving Network', contactName: 'Marta Lewandowska', contactEmail: 'accounts@ukenergysaving.co.uk', status: 'active', currency: 'GBP', creditScore: 38, activeCampaigns: 5, totalRevenue: 318940, createdAt: isoDaysAgo(360), agreementSigned: true, documentsCount: 6 },
  { id: 'cl-copious', companyName: 'Copious Limited', contactName: 'Daniel Okafor', contactEmail: 'finance@copious.io', status: 'active', currency: 'GBP', creditScore: 71, activeCampaigns: 3, totalRevenue: 96420, createdAt: isoDaysAgo(300), agreementSigned: true, documentsCount: 3 },
  { id: 'cl-apex', companyName: 'Apex Media Ltd', contactName: 'Sara Whitfield', contactEmail: 'sara@apexmedia.co.uk', status: 'active', currency: 'GBP', creditScore: 38, activeCampaigns: 1, totalRevenue: 22150, createdAt: isoDaysAgo(210), agreementSigned: false, documentsCount: 1 },
  { id: 'cl-clearhear', companyName: 'ClearHear Solutions', contactName: 'Tom Davies', contactEmail: 'tom@clearhear.co.uk', status: 'active', currency: 'GBP', creditScore: 64, activeCampaigns: 2, totalRevenue: 58730, createdAt: isoDaysAgo(180), agreementSigned: true, documentsCount: 2 },
  { id: 'cl-warmhome', companyName: 'WarmHome Insulation Co', contactName: 'Priya Nair', contactEmail: 'priya@warmhome.co.uk', status: 'prospect', currency: 'GBP', creditScore: null, activeCampaigns: 0, totalRevenue: 0, createdAt: isoDaysAgo(40), agreementSigned: false, documentsCount: 0 },
  { id: 'cl-legalfirst', companyName: 'LegalFirst Claims', contactName: 'Richard Adeyemi', contactEmail: 'richard@legalfirst.co.uk', status: 'active', currency: 'GBP', creditScore: 77, activeCampaigns: 2, totalRevenue: 73210, createdAt: isoDaysAgo(150), agreementSigned: true, documentsCount: 3 },
  { id: 'cl-suncrest', companyName: 'Suncrest Renewables', contactName: 'Hannah Clarke', contactEmail: 'hannah@suncrest.co.uk', status: 'inactive', currency: 'GBP', creditScore: 55, activeCampaigns: 0, totalRevenue: 12400, createdAt: isoDaysAgo(500), agreementSigned: true, documentsCount: 2 },
];

// ── Campaigns enrichment (use-campaigns → CampaignSummary) ──
// clientNames map per vertical so the buyer column shows real demo names.
const VERTICAL_CLIENTS: Record<string, string[]> = {
  Solar: ['UK Energy Saving Network', 'Suncrest Renewables'],
  'Hearing Aids': ['ClearHear Solutions'],
  'Property Sales': ['Benson Goldstein Ltd'],
  Insulation: ['UK Energy Saving Network', 'WarmHome Insulation Co'],
  'Legal — LPA': ['LegalFirst Claims'],
  'Legal — Police Claims': ['LegalFirst Claims'],
  'Will Writing': ['Copious Limited'],
  'PCP Claims': ['Apex Media Ltd'],
  'Private Medical Insurance': ['Copious Limited'],
};
const ADMIN_CAMPAIGNS = ADMIN_SOURCES.map(([vertical, pct], i) => {
  const totalLeads = Math.round(pct * 252);
  const leadPrice = 35 + (i % 4) * 5;
  const totalRevenue = totalLeads * leadPrice;
  const totalCost = Math.round(totalRevenue * (0.35 + (i % 3) * 0.08));
  const cpl = totalLeads ? Math.round((totalCost / totalLeads) * 100) / 100 : 0;
  const margin = totalRevenue ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 1000) / 10 : 0;
  const clientNames = VERTICAL_CLIENTS[vertical] ?? ['Managed'];
  const status = i % 7 === 5 ? 'paused' : i % 9 === 8 ? 'inactive' : 'active';
  const campaignType: 'pay_per_lead' | 'managed' | 'internal' =
    i % 3 === 0 ? 'pay_per_lead' : i % 3 === 1 ? 'managed' : 'internal';
  return {
    id: `lb-${1000 + i}`, name: `${vertical} — Lead Gen`,
    clientName: clientNames[0], clientNames,
    vertical, status, campaignType, leadPrice, currency: 'GBP',
    totalLeads,
    leadsToday: Math.round(totalLeads / 90),
    leadsThisWeek: Math.round(totalLeads / 12),
    leadsThisMonth: Math.round(totalLeads / 3),
    leadsLastMonth: Math.round(totalLeads / 3.2),
    totalRevenue, totalCost, cpl, margin,
    startDate: isoDaysAgo(120 + i * 10),
  };
});

const ADMIN_UNLINKED_SPEND = {
  windowDays: 30,
  total: 4820.42,
  rows: [
    { platform: 'facebook', accountId: 'act_104882711', accountName: 'Clinical Marketing — FB', spend: 2140.5, daysActive: 28 },
    { platform: 'google', accountId: '684-221-9930', accountName: 'CMS Search', spend: 1680.0, daysActive: 26 },
    { platform: 'tiktok', accountId: 'tt_77120934', accountName: null, spend: 640.42, daysActive: 14 },
    { platform: 'taboola', accountId: 'tb_55021', accountName: 'Native — Solar', spend: 359.5, daysActive: 9 },
  ],
};

// ── Invoices: enrich the existing recent list into a fuller paginated set ──
const ADMIN_INVOICES_FULL = [
  mkInvoice('INV-0414', 'Copious Limited', 'authorised', '2250.00', 2),
  mkInvoice('INV-0413', 'UK Energy Saving Network', 'authorised', '48.00', 4),
  mkInvoice('INV-0411', 'Benson Goldstein Ltd', 'overdue', '1708.20', 6, 4),
  mkInvoice('INV-0410', 'UK Energy Saving Network', 'draft', '25032.00', 7),
  mkInvoice('INV-0404', 'Copious Limited', 'overdue', '3150.00', 9, 7),
  mkInvoice('INV-0402', 'ClearHear Solutions', 'paid', '4620.00', 18),
  mkInvoice('INV-0399', 'LegalFirst Claims', 'sent', '8910.00', 12),
  mkInvoice('INV-0395', 'Benson Goldstein Ltd', 'paid', '1540.00', 35),
  mkInvoice('INV-0390', 'Apex Media Ltd', 'overdue', '960.00', 44, 14),
  mkInvoice('INV-0388', 'UK Energy Saving Network', 'paid', '12480.00', 50),
];
const ADMIN_INVOICE_CLIENTS = [
  { id: 'cl-copious', name: 'Copious Limited', email: 'finance@copious.io', vatRegistered: true, currency: 'GBP' },
  { id: 'cl-uesn', name: 'UK Energy Saving Network', email: 'accounts@ukenergysaving.co.uk', vatRegistered: true, currency: 'GBP' },
  { id: 'cl-bgl', name: 'Benson Goldstein Ltd', email: 'coby@bensongoldstein.co.uk', vatRegistered: false, currency: 'GBP' },
  { id: 'cl-clearhear', name: 'ClearHear Solutions', email: 'tom@clearhear.co.uk', vatRegistered: true, currency: 'GBP' },
  { id: 'cl-legalfirst', name: 'LegalFirst Claims', email: 'richard@legalfirst.co.uk', vatRegistered: true, currency: 'GBP' },
  { id: 'cl-apex', name: 'Apex Media Ltd', email: 'sara@apexmedia.co.uk', vatRegistered: false, currency: 'GBP' },
];

// ── Auto-invoice (use-auto-invoice) ──
const ADMIN_AUTO_INVOICE_RUNS = [
  { id: 'run-0007', periodFrom: isoDaysAgo(7), periodTo: isoDaysAgo(0), triggeredBy: 'scheduled', status: 'completed', clientsBilled: 4, clientsSkipped: 2, clientsFailed: 0, invoicesCreated: 4, totalAmount: '18420.00', currency: 'GBP', startedAt: isoDaysAgo(0), finishedAt: isoDaysAgo(0), error: null },
  { id: 'run-0006', periodFrom: isoDaysAgo(14), periodTo: isoDaysAgo(7), triggeredBy: 'scheduled', status: 'completed', clientsBilled: 5, clientsSkipped: 1, clientsFailed: 0, invoicesCreated: 5, totalAmount: '21960.00', currency: 'GBP', startedAt: isoDaysAgo(7), finishedAt: isoDaysAgo(7), error: null },
  { id: 'run-0005', periodFrom: isoDaysAgo(21), periodTo: isoDaysAgo(14), triggeredBy: 'manual', status: 'completed', clientsBilled: 3, clientsSkipped: 3, clientsFailed: 1, invoicesCreated: 3, totalAmount: '9240.00', currency: 'GBP', startedAt: isoDaysAgo(14), finishedAt: isoDaysAgo(14), error: null },
  { id: 'run-0004', periodFrom: isoDaysAgo(28), periodTo: isoDaysAgo(21), triggeredBy: 'scheduled', status: 'failed', clientsBilled: 0, clientsSkipped: 0, clientsFailed: 0, invoicesCreated: 0, totalAmount: '0.00', currency: 'GBP', startedAt: isoDaysAgo(21), finishedAt: isoDaysAgo(21), error: 'Xero rate-limited (HTTP 429) — run aborted, retried next cycle.' },
  { id: 'run-0003', periodFrom: isoDaysAgo(35), periodTo: isoDaysAgo(28), triggeredBy: 'scheduled', status: 'completed', clientsBilled: 4, clientsSkipped: 2, clientsFailed: 0, invoicesCreated: 4, totalAmount: '16110.00', currency: 'GBP', startedAt: isoDaysAgo(28), finishedAt: isoDaysAgo(28), error: null },
];
const ADMIN_AUTO_INVOICE_NEXT = { fromDate: isoDaysAgo(0), toDate: isoDaysAgo(-7), schedule: 'Weekly · Mondays 06:00' };

// ── Bank feed (use-bank-feed) ──
const ADMIN_COST_CATEGORIES = [
  { id: 'cc-rent', name: 'Office & Rent', bucket: 'fixed' as const, color: '#6366F1' },
  { id: 'cc-payroll', name: 'Payroll', bucket: 'fixed' as const, color: '#0EA5E9' },
  { id: 'cc-software', name: 'Software & SaaS', bucket: 'fixed' as const, color: '#8B5CF6' },
  { id: 'cc-adspend', name: 'Ad Spend', bucket: 'advertising' as const, color: '#22C55E' },
  { id: 'cc-legal', name: 'Legal & Professional', bucket: 'one_off' as const, color: '#F59E0B' },
  { id: 'cc-equipment', name: 'Equipment', bucket: 'one_off' as const, color: '#EF4444' },
];
const mkTxn = (i: number, date: string, amount: string, desc: string, vendor: string, cat?: { id: string; name: string; bucket: 'fixed' | 'one_off' | 'advertising' }) => ({
  id: `txn-${i}`, xeroBankTransactionId: `xero-bt-${i}`, xeroAccountId: '2', date, amount,
  currency: 'GBP', description: desc, vendorName: vendor,
  categoryId: cat?.id ?? null, categoryName: cat?.name ?? null, categoryBucket: cat?.bucket ?? null,
  isAutoCategorized: !!cat,
});
const fixed = ADMIN_COST_CATEGORIES[0], payroll = ADMIN_COST_CATEGORIES[1], software = ADMIN_COST_CATEGORIES[2], adspend = ADMIN_COST_CATEGORIES[3];
const ADMIN_BANK_TXNS = [
  mkTxn(1, isoDaysAgo(1), '-2140.50', 'Meta Platforms Ireland', 'Meta Platforms', adspend),
  mkTxn(2, isoDaysAgo(2), '-1680.00', 'Google Ads', 'Google Ireland', adspend),
  mkTxn(3, isoDaysAgo(3), '-8400.00', 'Monthly payroll run', 'Payroll', payroll),
  mkTxn(4, isoDaysAgo(4), '-1450.00', 'WeWork membership', 'WeWork', fixed),
  mkTxn(5, isoDaysAgo(5), '-240.00', 'Linear / Notion subscriptions', 'Linear', software),
  mkTxn(6, isoDaysAgo(6), '-99.00', 'Unknown direct debit', 'DD-77120', undefined),
  mkTxn(7, isoDaysAgo(7), '-512.40', 'TikTok Ads', 'TikTok Information', undefined),
  mkTxn(8, isoDaysAgo(8), '4620.00', 'Payment received — ClearHear', 'ClearHear Solutions', undefined),
  mkTxn(9, isoDaysAgo(9), '-180.00', 'AWS hosting', 'Amazon Web Services', software),
  mkTxn(10, isoDaysAgo(10), '-360.00', 'Companies House filings', 'Companies House', undefined),
];
const ADMIN_VENDOR_RULES = [
  { id: 'vr-1', vendorPattern: 'Meta Platforms', matchType: 'contains' as const, categoryId: 'cc-adspend', categoryName: 'Ad Spend' },
  { id: 'vr-2', vendorPattern: 'Google Ireland', matchType: 'contains' as const, categoryId: 'cc-adspend', categoryName: 'Ad Spend' },
  { id: 'vr-3', vendorPattern: 'WeWork', matchType: 'exact' as const, categoryId: 'cc-rent', categoryName: 'Office & Rent' },
  { id: 'vr-4', vendorPattern: 'Payroll', matchType: 'contains' as const, categoryId: 'cc-payroll', categoryName: 'Payroll' },
];

// ── HR / staff (use-staff) ──
const ADMIN_STAFF = [
  { id: 'st-1', name: 'Coby Benson', email: 'coby@stato.app', role: 'Managing Director', department: 'Operations' as const, startDate: isoDaysAgo(900), status: 'active' as const, holidaysRemaining: 18, holidaysTaken: 7 },
  { id: 'st-2', name: 'Sara Whitfield', email: 'sara@stato.app', role: 'Operations Manager', department: 'Operations' as const, startDate: isoDaysAgo(640), status: 'active' as const, holidaysRemaining: 12, holidaysTaken: 13 },
  { id: 'st-3', name: 'Daniel Okafor', email: 'daniel@stato.app', role: 'Finance Lead', department: 'Operations' as const, startDate: isoDaysAgo(520), status: 'active' as const, holidaysRemaining: 20, holidaysTaken: 5 },
  { id: 'st-4', name: 'Priya Nair', email: 'priya@stato.app', role: 'Content Strategist', department: 'Content Team' as const, startDate: isoDaysAgo(410), status: 'active' as const, holidaysRemaining: 9, holidaysTaken: 16 },
  { id: 'st-5', name: 'Tom Davies', email: 'tom@stato.app', role: 'Creative Designer', department: 'Content Team' as const, startDate: isoDaysAgo(300), status: 'on_leave' as const, holidaysRemaining: 4, holidaysTaken: 21 },
  { id: 'st-6', name: 'Hannah Clarke', email: 'hannah@stato.app', role: 'Copywriter', department: 'Content Team' as const, startDate: isoDaysAgo(220), status: 'active' as const, holidaysRemaining: 22, holidaysTaken: 3 },
  { id: 'st-7', name: 'Marcus Reid', email: 'marcus@stato.app', role: 'Campaign Analyst', department: 'Operations' as const, startDate: isoDaysAgo(120), status: 'active' as const, holidaysRemaining: 24, holidaysTaken: 1 },
];
const ADMIN_STAFF_STATS = { totalStaff: 7, activeStaff: 6, openPositions: 2, pendingHolidays: 2 };
const ADMIN_JOBS = [
  { id: 'job-1', title: 'Senior Campaign Manager', department: 'Operations', status: 'open' as const, applicantCount: 6, postedDate: isoDaysAgo(18) },
  { id: 'job-2', title: 'Performance Marketing Designer', department: 'Content Team', status: 'open' as const, applicantCount: 4, postedDate: isoDaysAgo(9) },
  { id: 'job-3', title: 'Junior Bookkeeper', department: 'Operations', status: 'closed' as const, applicantCount: 11, postedDate: isoDaysAgo(60) },
];
const ADMIN_APPLICANTS: Record<string, { id: string; name: string; email: string; jobId: string; stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'; appliedDate: string; score: number }[]> = {
  'job-1': [
    { id: 'ap-1', name: 'Elena Rossi', email: 'elena.rossi@example.com', jobId: 'job-1', stage: 'interview', appliedDate: isoDaysAgo(14), score: 86 },
    { id: 'ap-2', name: 'Jordan Mensah', email: 'jordan.m@example.com', jobId: 'job-1', stage: 'screening', appliedDate: isoDaysAgo(12), score: 74 },
    { id: 'ap-3', name: 'Priscilla Yang', email: 'priscilla.y@example.com', jobId: 'job-1', stage: 'offer', appliedDate: isoDaysAgo(16), score: 91 },
    { id: 'ap-4', name: 'Liam Murphy', email: 'liam.murphy@example.com', jobId: 'job-1', stage: 'applied', appliedDate: isoDaysAgo(4), score: 62 },
  ],
  'job-2': [
    { id: 'ap-5', name: 'Aisha Khan', email: 'aisha.k@example.com', jobId: 'job-2', stage: 'screening', appliedDate: isoDaysAgo(7), score: 79 },
    { id: 'ap-6', name: 'Nathaniel Cole', email: 'nathaniel.c@example.com', jobId: 'job-2', stage: 'applied', appliedDate: isoDaysAgo(3), score: 68 },
  ],
  'job-3': [
    { id: 'ap-7', name: 'Sofia Almeida', email: 'sofia.a@example.com', jobId: 'job-3', stage: 'hired', appliedDate: isoDaysAgo(55), score: 88 },
    { id: 'ap-8', name: 'George Patel', email: 'george.p@example.com', jobId: 'job-3', stage: 'rejected', appliedDate: isoDaysAgo(58), score: 51 },
  ],
};
const ADMIN_HOLIDAYS = [
  { id: 'hol-1', staffId: 'st-5', staffName: 'Tom Davies', type: 'annual' as const, startDate: isoDaysAgo(-3), endDate: isoDaysAgo(-10), status: 'approved' as const, approvedBy: 'Coby Benson' },
  { id: 'hol-2', staffId: 'st-4', staffName: 'Priya Nair', type: 'sick' as const, startDate: isoDaysAgo(2), endDate: isoDaysAgo(1), status: 'pending' as const, approvedBy: null },
  { id: 'hol-3', staffId: 'st-2', staffName: 'Sara Whitfield', type: 'annual' as const, startDate: isoDaysAgo(-14), endDate: isoDaysAgo(-21), status: 'pending' as const, approvedBy: null },
  { id: 'hol-4', staffId: 'st-6', staffName: 'Hannah Clarke', type: 'personal' as const, startDate: isoDaysAgo(-30), endDate: isoDaysAgo(-31), status: 'approved' as const, approvedBy: 'Sara Whitfield' },
];

// ── SOPs (use-sops) ──
const mkSop = (id: string, title: string, category: 'Operations' | 'Finance' | 'Onboarding' | 'Compliance' | 'Campaigns', author: string, daysAgo: number, status: 'published' | 'draft', tags: string[], loomUrl: string | null = null) => ({
  id, title,
  content: `## ${title}\n\nStep-by-step standard operating procedure for ${title.toLowerCase()}.\n\n1. Open the relevant dashboard.\n2. Verify the inputs.\n3. Complete the workflow and log the outcome.`,
  category, version: '1.0', author, lastUpdated: isoDaysAgo(daysAgo), status, loomUrl,
  screenshots: [], tags,
});
const ADMIN_SOPS = [
  mkSop('sop-1', 'Client onboarding checklist', 'Onboarding', 'Sara Whitfield', 5, 'published', ['onboarding', 'clients']),
  mkSop('sop-2', 'Raising a manual invoice in Xero', 'Finance', 'Daniel Okafor', 12, 'published', ['finance', 'xero', 'invoices']),
  mkSop('sop-3', 'Linking a Catchr ad account to a campaign', 'Campaigns', 'Marcus Reid', 9, 'published', ['campaigns', 'catchr']),
  mkSop('sop-4', 'TPS / CTPS compliance screening', 'Compliance', 'Coby Benson', 20, 'published', ['compliance', 'gdpr']),
  mkSop('sop-5', 'Weekly lead delivery reconciliation', 'Operations', 'Sara Whitfield', 3, 'draft', ['operations', 'leads']),
  mkSop('sop-6', 'Handling a credit-score drop alert', 'Finance', 'Daniel Okafor', 27, 'published', ['finance', 'credit'], 'https://www.loom.com/share/abcdef0123456789abcdef0123456789'),
];
const ADMIN_SOP_TAGS = [
  { tag: 'finance', count: 3 }, { tag: 'onboarding', count: 1 }, { tag: 'campaigns', count: 1 },
  { tag: 'compliance', count: 1 }, { tag: 'operations', count: 1 }, { tag: 'leads', count: 1 },
  { tag: 'xero', count: 1 }, { tag: 'catchr', count: 1 }, { tag: 'gdpr', count: 1 }, { tag: 'credit', count: 1 },
];

// ── SOS queue (use-sos) ──
const ADMIN_SOS = [
  { id: 'sos-1', userId: 'u-4', pagePath: '/finance/invoices', message: "Can't push INV-0410 to Xero — getting a 429.", resolvedAt: null, resolvedBy: null, createdAt: isoDaysAgo(0), userName: 'Priya Nair', userEmail: 'priya@stato.app' },
  { id: 'sos-2', userId: 'u-7', pagePath: '/campaigns/lb-1000', message: 'Catchr spend not showing on the Solar campaign.', resolvedAt: null, resolvedBy: null, createdAt: isoDaysAgo(0), userName: 'Marcus Reid', userEmail: 'marcus@stato.app' },
  { id: 'sos-3', userId: 'u-2', pagePath: '/clients/cl-uesn', message: 'How do I re-run a credit check?', resolvedAt: isoDaysAgo(1), resolvedBy: 'Coby Benson', createdAt: isoDaysAgo(2), userName: 'Sara Whitfield', userEmail: 'sara@stato.app' },
  { id: 'sos-4', userId: 'u-6', pagePath: '/tasks', message: 'Drag and drop on the board is laggy.', resolvedAt: isoDaysAgo(3), resolvedBy: 'Sara Whitfield', createdAt: isoDaysAgo(4), userName: 'Hannah Clarke', userEmail: 'hannah@stato.app' },
];

// ── Tasks (use-tasks → PaginatedTasks) ──
const mkTask = (id: string, title: string, status: 'todo' | 'in_progress' | 'completed' | 'on_hold', priority: 'low' | 'medium' | 'high' | 'urgent', assignee: string, category: string, dueAgo: number | null, mins: number | null = null, parentTaskId: string | null = null, parentTitle: string | null = null) => ({
  id, title, description: `${title} — auto-generated demo task.`,
  status, priority, assignee, category,
  dueDate: dueAgo === null ? null : isoDaysAgo(dueAgo),
  createdBy: 'Coby Benson', createdAt: isoDaysAgo(dueAgo === null ? 5 : Math.abs(dueAgo) + 3),
  timeBlockMinutes: mins, parentTaskId, parentTitle,
});
const ADMIN_TASKS = [
  mkTask('tk-1', 'Reconcile June lead deliveries', 'in_progress', 'high', 'Sara Whitfield', 'Operations', 1, 90),
  mkTask('tk-2', 'Chase overdue invoice INV-0411', 'todo', 'urgent', 'Daniel Okafor', 'Finance', 2, 30),
  mkTask('tk-3', 'Link Catchr account for TikTok Solar', 'todo', 'medium', 'Marcus Reid', 'Campaigns', -1, 45),
  mkTask('tk-4', 'Review WarmHome onboarding docs', 'on_hold', 'medium', 'Sara Whitfield', 'Onboarding', 4, 60),
  mkTask('tk-5', 'Refresh credit check — UK Energy Saving', 'todo', 'high', 'Daniel Okafor', 'Finance', 3, 20),
  mkTask('tk-6', 'Draft Q3 creative brief', 'in_progress', 'low', 'Priya Nair', 'Content', -5, 120),
  mkTask('tk-7', 'Approve hearing-aids carousel set', 'completed', 'medium', 'Tom Davies', 'Compliance', 0, 30),
  mkTask('tk-8', 'Sub: collect signed agreement', 'todo', 'medium', 'Sara Whitfield', 'Onboarding', 5, 15, 'tk-4', 'Review WarmHome onboarding docs'),
];
const ADMIN_TASK_CATEGORIES = ['Operations', 'Finance', 'Campaigns', 'Onboarding', 'Content', 'Compliance'];
const ADMIN_TASK_TEMPLATES = [
  { id: 'tt-1', name: 'New client onboarding', description: 'Standard checklist for bringing a new client live.', priority: 'high' as const, category: 'Onboarding' },
  { id: 'tt-2', name: 'Monthly invoice run review', description: 'Verify the auto-invoice run and chase exceptions.', priority: 'medium' as const, category: 'Finance' },
  { id: 'tt-3', name: 'Campaign launch QA', description: 'Pre-launch checks before a campaign goes live.', priority: 'high' as const, category: 'Campaigns' },
];

// ── Workflows (use-workflows) ──
const ADMIN_WORKFLOWS = [
  { id: 'wf-1', name: 'Chase overdue invoices', description: 'Emails clients when an invoice passes its due date.', type: 'finance', schedule: '0 9 * * *', status: 'active', handlerKey: 'chase-overdue', lastRunAt: isoDaysAgo(0), nextRunAt: isoDaysAgo(-1), totalRuns: 412, successRate: 98.5 },
  { id: 'wf-2', name: 'Weekly auto-invoicing', description: 'Generates invoices from validated lead deliveries.', type: 'finance', schedule: '0 6 * * 1', status: 'active', handlerKey: 'auto-invoice', lastRunAt: isoDaysAgo(0), nextRunAt: isoDaysAgo(-7), totalRuns: 52, successRate: 96.2 },
  { id: 'wf-3', name: 'Monthly validated-lead report', description: 'Compiles the validated-lead summary for each client.', type: 'reporting', schedule: '0 7 1 * *', status: 'active', handlerKey: 'monthly-validated', lastRunAt: isoDaysAgo(9), nextRunAt: isoDaysAgo(-21), totalRuns: 13, successRate: 100 },
  { id: 'wf-4', name: 'Credit-score watch', description: 'Alerts when a client credit score drops sharply.', type: 'risk', schedule: '0 8 * * *', status: 'active', handlerKey: null, lastRunAt: isoDaysAgo(0), nextRunAt: isoDaysAgo(-1), totalRuns: 188, successRate: 99.1 },
  { id: 'wf-5', name: 'LeadByte hourly sync', description: 'Pulls fresh lead + delivery data from LeadByte.', type: 'integration', schedule: '5 * * * *', status: 'paused', handlerKey: null, lastRunAt: isoDaysAgo(1), nextRunAt: null, totalRuns: 9840, successRate: 97.8 },
];

// ── Agreements (use-agreements; Wrap envelope) ──
const ADMIN_AGREEMENTS = [
  { id: 'agr-1', clientId: 'cl-bgl', providerEnvelopeId: 'sn-env-1001', signerEmail: 'coby@bensongoldstein.co.uk', signerName: 'Coby Benson', signerRole: 'Director', status: 'completed' as const, sentAt: isoDaysAgo(120), signedAt: isoDaysAgo(118), declinedAt: null, declinedReason: null, pdfR2Key: 'agreements/bgl-signed.pdf', documentUrl: null, signedByClient: true },
  { id: 'agr-2', clientId: 'cl-uesn', providerEnvelopeId: 'sn-env-1002', signerEmail: 'accounts@ukenergysaving.co.uk', signerName: 'Marta Lewandowska', signerRole: 'Finance Director', status: 'completed' as const, sentAt: isoDaysAgo(90), signedAt: isoDaysAgo(88), declinedAt: null, declinedReason: null, pdfR2Key: 'agreements/uesn-signed.pdf', documentUrl: null, signedByClient: true },
  { id: 'agr-3', clientId: 'cl-clearhear', providerEnvelopeId: 'sn-env-1003', signerEmail: 'tom@clearhear.co.uk', signerName: 'Tom Davies', signerRole: 'CEO', status: 'delivered' as const, sentAt: isoDaysAgo(6), signedAt: null, declinedAt: null, declinedReason: null, pdfR2Key: null, documentUrl: null, signedByClient: false },
  { id: 'agr-4', clientId: 'cl-warmhome', providerEnvelopeId: 'sn-env-1004', signerEmail: 'priya@warmhome.co.uk', signerName: 'Priya Nair', signerRole: 'Director', status: 'sent' as const, sentAt: isoDaysAgo(2), signedAt: null, declinedAt: null, declinedReason: null, pdfR2Key: null, documentUrl: null, signedByClient: false },
  { id: 'agr-5', clientId: 'cl-apex', providerEnvelopeId: 'sn-env-1005', signerEmail: 'sara@apexmedia.co.uk', signerName: 'Sara Whitfield', signerRole: 'Managing Director', status: 'declined' as const, sentAt: isoDaysAgo(30), signedAt: null, declinedAt: isoDaysAgo(26), declinedReason: 'Requested revised CPL terms before signing.', pdfR2Key: null, documentUrl: null, signedByClient: false },
];
const ADMIN_AGREEMENT_TEMPLATES = [
  { id: 'tpl-1', name: 'Managed service agreement', description: 'Default 12-month managed lead-gen contract.', pdfR2Key: 'agreements/templates/managed.pdf', fieldLayout: [], signerRole: 'Director', archivedAt: null, createdAt: isoDaysAgo(200), updatedAt: isoDaysAgo(30) },
  { id: 'tpl-2', name: 'Pay-per-lead agreement', description: 'PPL terms with per-vertical CPL schedule.', pdfR2Key: 'agreements/templates/ppl.pdf', fieldLayout: [], signerRole: 'Director', archivedAt: null, createdAt: isoDaysAgo(180), updatedAt: isoDaysAgo(45) },
  { id: 'tpl-3', name: 'Data-processing addendum', description: 'GDPR DPA addendum for compliance sign-off.', pdfR2Key: 'agreements/templates/dpa.pdf', fieldLayout: [], signerRole: 'Compliance Officer', archivedAt: null, createdAt: isoDaysAgo(150), updatedAt: isoDaysAgo(60) },
];

// ── Unified report (use-reports → UnifiedReportResponse) ──
const REPORT_DEFS: [string, string, string[], { supplier: string; platform: string; leads: number; spend: number; revenue: number }[]][] = [
  ['camp-solar', 'Solar — Lead Gen', ['UK Energy Saving Network', 'Suncrest Renewables'], [
    { supplier: 'Meta — Solar', platform: 'facebook', leads: 4200, spend: 84000, revenue: 168000 },
    { supplier: 'Google — Solar', platform: 'google', leads: 1800, spend: 52000, revenue: 79200 },
    { supplier: 'TikTok — Solar', platform: 'tiktok', leads: 900, spend: 18000, revenue: 31500 },
  ]],
  ['camp-hearing', 'Hearing Aids — Lead Gen', ['ClearHear Solutions'], [
    { supplier: 'Meta — Hearing', platform: 'facebook', leads: 1600, spend: 28000, revenue: 64000 },
    { supplier: 'Taboola — Hearing', platform: 'taboola', leads: 700, spend: 14000, revenue: 24500 },
  ]],
  ['camp-insulation', 'Insulation — Lead Gen', ['UK Energy Saving Network', 'WarmHome Insulation Co'], [
    { supplier: 'Google — Insulation', platform: 'google', leads: 1400, spend: 31000, revenue: 49000 },
    { supplier: 'Meta — Insulation', platform: 'facebook', leads: 1100, spend: 19000, revenue: 38500 },
  ]],
  ['camp-legal', 'Legal — LPA — Lead Gen', ['LegalFirst Claims'], [
    { supplier: 'Direct', platform: 'direct', leads: 600, spend: 0, revenue: 30000 },
    { supplier: 'Bing — Legal', platform: 'bing', leads: 300, spend: 9000, revenue: 15000 },
  ]],
];
const ADMIN_REPORT_ROWS = REPORT_DEFS.flatMap(([campaignId, campaignName, clientNames, suppliers], ci) =>
  suppliers.map((s) => {
    const profit = s.revenue - s.spend;
    const cpl = s.leads ? Math.round((s.spend / s.leads) * 100) / 100 : 0;
    const margin = s.revenue ? Math.round(((s.revenue - s.spend) / s.revenue) * 1000) / 10 : 0;
    const vertical = campaignName.replace(/ — Lead Gen$/, '');
    return {
      campaignId, campaignName, clientName: clientNames[0], clientNames, vertical,
      supplier: s.supplier, supplierPlatform: s.platform,
      catchrUrl: s.spend > 0 ? `https://app.catchr.io/report/${s.platform}-${ci}` : null,
      leads: s.leads, spend: s.spend, revenue: s.revenue, profit, cpl, margin,
    };
  }),
);
const ADMIN_REPORT_TOTALS = (() => {
  const leads = ADMIN_REPORT_ROWS.reduce((a, r) => a + r.leads, 0);
  const spend = ADMIN_REPORT_ROWS.reduce((a, r) => a + r.spend, 0);
  const revenue = ADMIN_REPORT_ROWS.reduce((a, r) => a + r.revenue, 0);
  const profit = revenue - spend;
  const margin = revenue ? Math.round(((revenue - spend) / revenue) * 1000) / 10 : 0;
  return { leads, spend, revenue, profit, margin };
})();
const ADMIN_UNIFIED_REPORT = {
  window: 'this_month' as const, supplier: null, campaign: null,
  rows: ADMIN_REPORT_ROWS, totals: ADMIN_REPORT_TOTALS,
};

// ── Integrations overview + status endpoints ──
const ADMIN_INTEGRATIONS_OVERVIEW = {
  xero: { configured: true, connected: true, tenantName: 'Clinical Marketing Solutions Ltd', lastError: null },
  leadbyte: { configured: true, lastSyncAt: isoDaysAgo(0), leadsThisMonth: 8420, leadsLast12Months: 101240, skippedCampaigns: [
    { campaignId: 'lb-1003', campaignName: 'Insulation — Lead Gen', buyerCount: 2, at: isoDaysAgo(1) },
  ] },
  catchr: { configured: true, connected: true, platformsConnected: 4, lastError: null, lastSyncAt: isoDaysAgo(0), adSpendLast30Days: 120092, currency: 'GBP' },
  signnow: { configured: true, sandbox: false, agreementCount: 5 },
  r2: { configured: true, bucket: 'stato-prod', fileCount: 1284 },
  resend: { configured: true, fromEmail: 'invoices@stato.app' },
  creditCheck: { configured: true, provider: 'endole' as const, sandbox: false, checksRun: 142 },
  anthropic: { configured: true },
};
const ADMIN_CATCHR_PLATFORMS = {
  configured: true,
  platforms: [
    { id: 'facebook', name: 'Facebook Ads', connected: true },
    { id: 'google', name: 'Google Ads', connected: true },
    { id: 'tiktok', name: 'TikTok Ads', connected: true },
    { id: 'taboola', name: 'Taboola', connected: true },
    { id: 'bing', name: 'Microsoft Ads', connected: false },
  ],
};
const ADMIN_CATCHR_ACCOUNTS = {
  configured: true,
  accounts: [
    { id: 'act_104882711', name: 'Clinical Marketing — FB', platform: 'facebook', sourceName: 'Meta Ads' },
    { id: '684-221-9930', name: 'CMS Search', platform: 'google', sourceName: 'Google Ads' },
    { id: 'tt_77120934', name: 'CMS TikTok', platform: 'tiktok', sourceName: 'TikTok Ads' },
    { id: 'tb_55021', name: 'Native — Solar', platform: 'taboola', sourceName: 'Taboola' },
  ],
};

// ── LeadByte buyers (use-leadbyte; Wrap envelope) — for /leadbyte/buyers ──
const ADMIN_LB_BUYERS = [
  { id: 1, company: 'UK Energy Saving Network', bid: 'BID-1001', status: 'Active' as const, credit_amount: 50000, credit_balance: 18420, phone: '020 7946 0011', postcode: 'EC1A 1BB' },
  { id: 2, company: 'ClearHear Solutions', bid: 'BID-1002', status: 'Active' as const, credit_amount: 20000, credit_balance: 9240, phone: '0161 496 0022', postcode: 'M1 2AB' },
  { id: 3, company: 'LegalFirst Claims', bid: 'BID-1003', status: 'Active' as const, credit_amount: 30000, credit_balance: 14110, phone: '0121 234 0033', postcode: 'B1 1AA' },
  { id: 4, company: 'Copious Limited', bid: 'BID-1004', status: 'Active' as const, credit_amount: 15000, credit_balance: 3050, phone: '0117 925 0044', postcode: 'BS1 4ST' },
  { id: 5, company: 'Apex Media Ltd', bid: 'BID-1005', status: 'Inactive' as const, credit_amount: 5000, credit_balance: 0, phone: '0113 245 0055', postcode: 'LS1 4DY' },
  { id: 6, company: 'Suncrest Renewables', bid: 'BID-1006', status: 'Inactive' as const, credit_amount: 8000, credit_balance: 420, phone: '0131 220 0066', postcode: 'EH1 1YZ' },
];

// ── Users list (use raw fetch in users.tsx — see note in getDevMock) ──
const ADMIN_USERS = [
  { id: 'u-1', email: 'coby@stato.app', name: 'Coby Benson', role: 'owner', businessId: 'biz-1', clientId: null, isActive: true, isPrimaryOwner: true, createdAt: isoDaysAgo(900) },
  { id: 'u-2', email: 'sara@stato.app', name: 'Sara Whitfield', role: 'ops_manager', businessId: 'biz-1', clientId: null, isActive: true, createdAt: isoDaysAgo(640) },
  { id: 'u-3', email: 'daniel@stato.app', name: 'Daniel Okafor', role: 'finance_admin', businessId: 'biz-1', clientId: null, isActive: true, createdAt: isoDaysAgo(520) },
  { id: 'u-4', email: 'priya@stato.app', name: 'Priya Nair', role: 'readonly', businessId: 'biz-1', clientId: null, isActive: true, createdAt: isoDaysAgo(410) },
  { id: 'u-5', email: 'coby@bensongoldstein.co.uk', name: 'Benson Goldstein (Client)', role: 'client', businessId: 'biz-1', clientId: 'cl-bgl', isActive: true, createdAt: isoDaysAgo(118) },
  { id: 'u-6', email: 'hannah@stato.app', name: 'Hannah Clarke', role: 'readonly', businessId: 'biz-1', clientId: null, isActive: false, createdAt: isoDaysAgo(220) },
];

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
      case '/api/v1/campaigns/unlinked-spend': return ok(ADMIN_UNLINKED_SPEND);
      case '/api/v1/invoices': return ok({ invoices: ADMIN_INVOICES_FULL, total: ADMIN_INVOICES_FULL.length, page: 1, pageSize: 20 });
      case '/api/v1/invoices/clients': return ok({ clients: ADMIN_INVOICE_CLIENTS });
      case '/api/v1/invoices/outstanding': return ok({ bucket: 'all', invoices: ADMIN_OUTSTANDING, count: ADMIN_OUTSTANDING.length, totalOutstanding: '128748.20' });
      case '/api/v1/integrations/xero/bank-accounts': return ok(ADMIN_BANK);
      case '/api/v1/integrations/xero/vat-liability': return ok(ADMIN_VAT);
      case '/api/v1/reports/pnl-summary': return ok(ADMIN_PNL);
      case '/api/v1/clients': return ok({ clients: ADMIN_CLIENTS, total: ADMIN_CLIENTS.length, page: 1, pageSize: 10 });
      case '/api/v1/clients/credit-alerts': return ok({ alerts: ADMIN_CREDIT });
      case '/api/v1/tasks': return ok({ tasks: ADMIN_TASKS, total: ADMIN_TASKS.length, page: 1, pageSize: 50 });
      case '/api/v1/tasks/stats': return ok({ stats: ADMIN_TASK_STATS });
      case '/api/v1/tasks/categories': return ok({ categories: ADMIN_TASK_CATEGORIES });
      case '/api/v1/tasks/templates': return ok({ templates: ADMIN_TASK_TEMPLATES });
      case '/api/v1/notifications': return ok(ADMIN_NOTIFICATIONS);
      // ── Finance: auto-invoice ──
      case '/api/v1/finance/auto-invoice/runs': return ok({ runs: ADMIN_AUTO_INVOICE_RUNS });
      case '/api/v1/finance/auto-invoice/runs/next': return ok(ADMIN_AUTO_INVOICE_NEXT);
      // ── Finance: bank feed ──
      case '/api/v1/finance/bank-feed/transactions': return ok({ transactions: ADMIN_BANK_TXNS, total: ADMIN_BANK_TXNS.length, page: 1, pageSize: 50 });
      case '/api/v1/finance/bank-feed/categories': return ok({ categories: ADMIN_COST_CATEGORIES });
      case '/api/v1/finance/bank-feed/sync/status': return ok({ lastSyncAt: isoDaysAgo(0) });
      case '/api/v1/finance/bank-feed/rules': return ok({ rules: ADMIN_VENDOR_RULES });
      // ── HR / staff ──
      case '/api/v1/hr/staff': return ok({ staff: ADMIN_STAFF });
      case '/api/v1/hr/staff/stats': return ok({ stats: ADMIN_STAFF_STATS });
      case '/api/v1/hr/jobs': return ok({ jobs: ADMIN_JOBS });
      case '/api/v1/hr/holidays': return ok({ holidays: ADMIN_HOLIDAYS });
      // ── SOPs ──
      case '/api/v1/sops': return ok({ sops: ADMIN_SOPS, total: ADMIN_SOPS.length, page: 1, pageSize: 20 });
      case '/api/v1/sops/tags': return ok({ tags: ADMIN_SOP_TAGS });
      // ── SOS queue ──
      case '/api/v1/sos': return ok({ requests: ADMIN_SOS });
      // ── Workflows ──
      case '/api/v1/workflows': return ok({ workflows: ADMIN_WORKFLOWS });
      // ── Agreements (Wrap envelope) ──
      case '/api/v1/agreements': return ok({ agreements: ADMIN_AGREEMENTS });
      case '/api/v1/agreement-templates': return ok({ templates: ADMIN_AGREEMENT_TEMPLATES });
      // ── Unified report ──
      case '/api/v1/reports/unified': return ok(ADMIN_UNIFIED_REPORT);
      // ── Integrations ──
      case '/api/v1/integrations/overview': return ok(ADMIN_INTEGRATIONS_OVERVIEW);
      case '/api/v1/integrations/catchr/platforms': return ok(ADMIN_CATCHR_PLATFORMS);
      case '/api/v1/integrations/catchr/accounts': return ok(ADMIN_CATCHR_ACCOUNTS);
      case '/api/v1/integrations/xero/status': return ok({ connected: true, configured: true, tenantId: 'tn-clinical-marketing', tenantName: 'Clinical Marketing Solutions Ltd' });
      case '/api/v1/integrations/leadbyte/status': return ok({ configured: true, lastSyncAt: isoDaysAgo(0) });
      case '/api/v1/integrations/credit-check/status': return ok({ provider: 'endole', configured: true, checksRun: 142 });
      case '/api/v1/integrations/resend/status': return ok({ configured: true, fromEmail: 'invoices@stato.app', fromName: 'Stato Finance' });
      case '/api/v1/integrations/signnow/status': return ok({ configured: true, baseUrl: 'https://api.signnow.com', username: 'ops@stato.app', sandbox: false });
      case '/api/v1/integrations/r2/status': return ok({ configured: true, bucket: 'stato-prod', publicBaseUrl: 'https://files.stato.app' });
      case '/api/v1/integrations/catchr/status': return ok({ configured: true, mcpUrl: 'https://mcp.catchr.io', lastSyncAt: isoDaysAgo(0) });
      // ── LeadByte buyers (Wrap envelope) ──
      case '/api/v1/leadbyte/buyers': return ok(ADMIN_LB_BUYERS);
      // ── Settings → Users (NOTE: users.tsx uses raw fetch(), which bypasses
      // this mock layer; kept here for completeness / future api-client use) ──
      case '/api/v1/users': return ok({ users: ADMIN_USERS });
      default:
        if (/^\/api\/v1\/portal\/creatives\/[^/]+\/signed-url$/.test(pathname)) return ok({ url: PLACEHOLDER_IMG });
        {
          const jobApplicants = /^\/api\/v1\/hr\/jobs\/([^/]+)\/applicants$/.exec(pathname);
          if (jobApplicants) return ok({ applicants: ADMIN_APPLICANTS[jobApplicants[1]] ?? [] });
        }
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
