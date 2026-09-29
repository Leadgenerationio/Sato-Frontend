import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useUiStore } from '@/stores/ui-store';
import { SosButton } from '@/components/shared/sos-button';
import { SectionGuard } from '@/components/shared/section-guard';

// Stato Admin shell — Statto green chrome (Admin Dashboard.html → dash-app.jsx).
// Flex shell: sticky sidebar rail + main column (sticky top bar + scrolling
// view). Collapse + mobile-drawer state come from the shared ui-store.
export function DashboardLayout() {
  const { sidebarOpen, mobileSidebarOpen } = useUiStore();

  return (
    <div
      className={
        'statto-admin aapp'
        + (sidebarOpen ? '' : ' is-collapsed')
        + (mobileSidebarOpen ? ' mobile-nav-open' : '')
      }
    >
      <Sidebar />
      <div className="amain">
        <Header />
        <div className="aview">
          <div className="aview-inner">
            <SectionGuard><Outlet /></SectionGuard>
          </div>
        </div>
      </div>
      <SosButton />
    </div>
  );
}
