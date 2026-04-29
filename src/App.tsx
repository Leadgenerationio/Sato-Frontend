import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/components/providers/auth-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { ProtectedRoute } from '@/components/shared/protected-route';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { PortalLayout } from '@/components/layouts/portal-layout';
import { Toaster } from '@/components/ui/sonner';
import { LoginPage } from '@/pages/login';

// Pages are lazy-loaded so the initial bundle ships only what's needed for
// the login + layout. Each route now downloads its own chunk on first visit
// (~80% reduction in initial JS for first-time users). Subsequent navigations
// to the same route are cached by Vite's runtime, so it's "pay once, free
// after" per route.
//
// The repeated `then((m) => ({ default: m.X }))` pattern is React.lazy's
// requirement that the imported module expose a `default` export — our pages
// use named exports, so we adapt them inline.

const DashboardPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })));
const SettingsPage = lazy(() => import('@/pages/settings').then((m) => ({ default: m.SettingsPage })));
const CampaignsPage = lazy(() => import('@/pages/campaigns/index').then((m) => ({ default: m.CampaignsPage })));
const CampaignDetailPage = lazy(() => import('@/pages/campaigns/detail').then((m) => ({ default: m.CampaignDetailPage })));
const InvoiceListPage = lazy(() => import('@/pages/finance/invoices').then((m) => ({ default: m.InvoiceListPage })));
const InvoiceDetailPage = lazy(() => import('@/pages/finance/invoice-detail').then((m) => ({ default: m.InvoiceDetailPage })));
const InvoiceCreatePage = lazy(() => import('@/pages/finance/invoice-create').then((m) => ({ default: m.InvoiceCreatePage })));
const BankFeedPage = lazy(() => import('@/pages/finance/bank-feed').then((m) => ({ default: m.BankFeedPage })));
const ClientsPage = lazy(() => import('@/pages/clients/index').then((m) => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() => import('@/pages/clients/detail').then((m) => ({ default: m.ClientDetailPage })));
const ClientCreatePage = lazy(() => import('@/pages/clients/create').then((m) => ({ default: m.ClientCreatePage })));
const WorkflowsPage = lazy(() => import('@/pages/workflows/index').then((m) => ({ default: m.WorkflowsPage })));
const WorkflowDetailPage = lazy(() => import('@/pages/workflows/detail').then((m) => ({ default: m.WorkflowDetailPage })));
const WorkflowCreatePage = lazy(() => import('@/pages/workflows/create').then((m) => ({ default: m.WorkflowCreatePage })));
const TasksPage = lazy(() => import('@/pages/tasks/index').then((m) => ({ default: m.TasksPage })));
const TaskDetailPage = lazy(() => import('@/pages/tasks/detail').then((m) => ({ default: m.TaskDetailPage })));
const TaskCreatePage = lazy(() => import('@/pages/tasks/create').then((m) => ({ default: m.TaskCreatePage })));
const ReportsHubPage = lazy(() => import('@/pages/reports/index').then((m) => ({ default: m.ReportsHubPage })));
const CampaignReportPage = lazy(() => import('@/pages/reports/campaign').then((m) => ({ default: m.CampaignReportPage })));
const ClientPnlReportPage = lazy(() => import('@/pages/reports/client-pnl').then((m) => ({ default: m.ClientPnlReportPage })));
const SupplierReportPage = lazy(() => import('@/pages/reports/supplier').then((m) => ({ default: m.SupplierReportPage })));
const FinancialReportPage = lazy(() => import('@/pages/reports/financial').then((m) => ({ default: m.FinancialReportPage })));
const AdSpendReportPage = lazy(() => import('@/pages/reports/ad-spend').then((m) => ({ default: m.AdSpendReportPage })));
const PortalDashboardPage = lazy(() => import('@/pages/portal/dashboard').then((m) => ({ default: m.PortalDashboardPage })));
const PortalLeadsPage = lazy(() => import('@/pages/portal/leads').then((m) => ({ default: m.PortalLeadsPage })));
const PortalInvoicesPage = lazy(() => import('@/pages/portal/invoices').then((m) => ({ default: m.PortalInvoicesPage })));
const PortalCompliancePage = lazy(() => import('@/pages/portal/compliance').then((m) => ({ default: m.PortalCompliancePage })));
const PortalAgreementPage = lazy(() => import('@/pages/portal/agreement').then((m) => ({ default: m.PortalAgreementPage })));
const NotificationsPage = lazy(() => import('@/pages/notifications').then((m) => ({ default: m.NotificationsPage })));
const SopsPage = lazy(() => import('@/pages/sops/index').then((m) => ({ default: m.SopsPage })));
const SopDetailPage = lazy(() => import('@/pages/sops/detail').then((m) => ({ default: m.SopDetailPage })));
const SopCreatePage = lazy(() => import('@/pages/sops/create').then((m) => ({ default: m.SopCreatePage })));
const SopEditPage = lazy(() => import('@/pages/sops/edit').then((m) => ({ default: m.SopEditPage })));
const StaffPage = lazy(() => import('@/pages/staff/index').then((m) => ({ default: m.StaffPage })));
const StaffDetailPage = lazy(() => import('@/pages/staff/detail').then((m) => ({ default: m.StaffDetailPage })));
const OrgChartPage = lazy(() => import('@/pages/staff/org-chart').then((m) => ({ default: m.OrgChartPage })));
const NotFoundPage = lazy(() => import('@/pages/not-found').then((m) => ({ default: m.NotFoundPage })));
const LeadByteBuyersPage = lazy(() => import('@/pages/leadbyte/buyers').then((m) => ({ default: m.LeadByteBuyersPage })));
const LeadByteDeliveriesPage = lazy(() => import('@/pages/leadbyte/deliveries').then((m) => ({ default: m.LeadByteDeliveriesPage })));
const LeadByteRespondersPage = lazy(() => import('@/pages/leadbyte/responders').then((m) => ({ default: m.LeadByteRespondersPage })));
const LeadByteDashboardPage = lazy(() => import('@/pages/leadbyte/dashboard').then((m) => ({ default: m.LeadByteDashboardPage })));
const AgreementsPage = lazy(() => import('@/pages/agreements').then((m) => ({ default: m.AgreementsPage })));

function RouteFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function App() {
  return (
    <QueryProvider>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — dashboard layout (staff roles only; client goes to /portal) */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['owner', 'finance_admin', 'ops_manager', 'readonly']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route
              path="/finance/invoices"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <InvoiceListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/invoices/create"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <InvoiceCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/invoices/:id"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <InvoiceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/bank-feed"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <BankFeedPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin', 'ops_manager']}>
                  <ClientsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients/create"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin', 'ops_manager']}>
                  <ClientCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients/:id"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin', 'ops_manager']}>
                  <ClientDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <CampaignsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campaigns/:id"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <CampaignDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workflows"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <WorkflowsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workflows/create"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <WorkflowCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workflows/:id"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <WorkflowDetailPage />
                </ProtectedRoute>
              }
            />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/create" element={<TaskCreatePage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
            <Route path="/sops" element={<SopsPage />} />
            <Route path="/sops/create" element={<SopCreatePage />} />
            <Route path="/sops/:id/edit" element={<SopEditPage />} />
            <Route path="/sops/:id" element={<SopDetailPage />} />
            <Route
              path="/staff"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <StaffPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/org-chart"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <OrgChartPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/:id"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <StaffDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <ReportsHubPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/campaign"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <CampaignReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/client-pnl"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <ClientPnlReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/supplier"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <SupplierReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/financial"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <FinancialReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/ad-spend"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <AdSpendReportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leadbyte"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager', 'finance_admin']}>
                  <LeadByteDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leadbyte/buyers"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <LeadByteBuyersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agreements"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <AgreementsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leadbyte/deliveries"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <LeadByteDeliveriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leadbyte/responders"
              element={
                <ProtectedRoute allowedRoles={['owner', 'ops_manager']}>
                  <LeadByteRespondersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin', 'ops_manager']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Client Portal — separate layout, client role only */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['client']}>
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/portal" element={<PortalDashboardPage />} />
            <Route path="/portal/leads" element={<PortalLeadsPage />} />
            <Route path="/portal/invoices" element={<PortalInvoicesPage />} />
            <Route path="/portal/compliance" element={<PortalCompliancePage />} />
            <Route path="/portal/agreement" element={<PortalAgreementPage />} />
          </Route>

          {/* 404 catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
        <Toaster position="bottom-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
    </QueryProvider>
  );
}
