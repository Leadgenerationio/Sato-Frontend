import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { useUiStore } from '@/stores/ui-store';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { toast } from 'sonner';
import { Bell, LogOut, Menu } from 'lucide-react';

// Stato Admin top bar — Statto chrome (Admin Dashboard.html → dash-ui.jsx TopBar).
export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toggleMobileSidebar } = useUiStore();
  const { data: unreadData } = useNotifications({ filter: 'unread', limit: 1 });

  if (!user) return null;

  const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const unreadCount = unreadData?.total ?? 0;

  return (
    <header className="atop">
      <button className="atop-burger" onClick={toggleMobileSidebar} aria-label="Open menu"><Menu className="size-5" /></button>
      <div className="atop-right">
        <button className="atop-bell" title="Notifications" aria-label="Notifications" onClick={() => navigate('/notifications')}>
          <Bell className="size-5" />
          {unreadCount > 0 && <span className="atop-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>
        <span className="atop-role">{user.role.replace('_', ' ')}</span>
        <span className="atop-avatar" aria-hidden="true">{initials}</span>
        <span className="atop-name">{user.name}</span>
        <button
          className="atop-logout"
          title="Sign out"
          aria-label="Sign out"
          onClick={() => { logout(); toast.info('Signed out', { description: 'You have been signed out.' }); }}
        >
          <LogOut className="size-[19px]" />
        </button>
      </div>
    </header>
  );
}
