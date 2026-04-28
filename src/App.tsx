import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/components/providers/auth-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { ProtectedRoute } from '@/components/shared/protected-route';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { Toaster } from '@/components/ui/sonner';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { SettingsPage } from '@/pages/settings';
import { CampaignsPage } from '@/pages/campaigns/index';
import { CampaignDetailPage } from '@/pages/campaigns/detail';
import { InvoiceListPage } from '@/pages/finance/invoices';
import { InvoiceDetailPage } from '@/pages/finance/invoice-detail';
import { InvoiceCreatePage } from '@/pages/finance/invoice-create';
import { SubscriptionsPage } from '@/pages/finance/subscriptions';
import { BankFeedPage } from '@/pages/finance/bank-feed';
import { ClientsPage } from '@/pages/clients/index';
import { ClientDetailPage } from '@/pages/clients/detail';
import { ClientCreatePage } from '@/pages/clients/create';
import { WorkflowsPage } from '@/pages/workflows/index';
import { WorkflowDetailPage } from '@/pages/workflows/detail';
import { WorkflowCreatePage } from '@/pages/workflows/create';
import { TasksPage } from '@/pages/tasks/index';
import { TaskDetailPage } from '@/pages/tasks/detail';
import { TaskCreatePage } from '@/pages/tasks/create';
import { ReportsHubPage } from '@/pages/reports/index';
import { CampaignReportPage } from '@/pages/reports/campaign';
import { ClientPnlReportPage } from '@/pages/reports/client-pnl';
import { SupplierReportPage } from '@/pages/reports/supplier';
import { FinancialReportPage } from '@/pages/reports/financial';
import { AdSpendReportPage } from '@/pages/reports/ad-spend';
import { PortalLayout } from '@/components/layouts/portal-layout';
import { PortalDashboardPage } from '@/pages/portal/dashboard';
import { PortalCampaignsPage } from '@/pages/portal/campaigns';
import { PortalLeadsPage } from '@/pages/portal/leads';
import { PortalInvoicesPage } from '@/pages/portal/invoices';
import { PortalCompliancePage } from '@/pages/portal/compliance';
import { PortalAgreementPage } from '@/pages/portal/agreement';
import { NotificationsPage } from '@/pages/notifications';
import { SopsPage } from '@/pages/sops/index';
import { SopDetailPage } from '@/pages/sops/detail';
import { SopCreatePage } from '@/pages/sops/create';
import { SopEditPage } from '@/pages/sops/edit';
import { StaffPage } from '@/pages/staff/index';
import { StaffDetailPage } from '@/pages/staff/detail';
import { OrgChartPage } from '@/pages/staff/org-chart';
import { NotFoundPage } from '@/pages/not-found';
import { LeadByteBuyersPage } from '@/pages/leadbyte/buyers';
import { LeadByteDeliveriesPage } from '@/pages/leadbyte/deliveries';
import { LeadByteRespondersPage } from '@/pages/leadbyte/responders';
import { LeadByteDashboardPage } from '@/pages/leadbyte/dashboard';
import { AgreementsPage } from '@/pages/agreements';

export default function App() {
  return (
    <QueryProvider>
    <BrowserRouter>
      <AuthProvider>
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
              path="/finance/subscriptions"
              element={
                <ProtectedRoute allowedRoles={['owner', 'finance_admin']}>
                  <SubscriptionsPage />
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
            <Route path="/portal/campaigns" element={<PortalCampaignsPage />} />
            <Route path="/portal/leads" element={<PortalLeadsPage />} />
            <Route path="/portal/invoices" element={<PortalInvoicesPage />} />
            <Route path="/portal/compliance" element={<PortalCompliancePage />} />
            <Route path="/portal/agreement" element={<PortalAgreementPage />} />
          </Route>

          {/* 404 catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster position="bottom-right" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
    </QueryProvider>
  );
}
