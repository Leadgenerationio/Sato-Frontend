import { Link } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { useUiStore } from '@/stores/ui-store';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Bell, LogOut, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/shared/logo';

export function Header() {
  const { user, logout } = useAuth();
  const { sidebarOpen } = useUiStore();
  const { data: unreadData } = useNotifications({ filter: 'unread', limit: 1 });

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const unreadCount = unreadData?.total ?? 0;

  return (
    <header className={cn(
      'fixed top-0 right-0 z-30 flex h-16 items-center border-b bg-background px-4 sm:px-6 transition-all duration-300',
      'left-0 md:left-16',
      sidebarOpen && 'md:left-64',
    )}>
      {/* Mobile-only: hamburger + logo (sidebar lives off-canvas on mobile) */}
      <div className="flex items-center gap-2 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMobileSidebar}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Logo size="sm" />
      </div>
      <div className="ml-auto flex items-center gap-3">
        {/* Notification Bell */}
        <Link to="/notifications" className="relative inline-flex items-center justify-center size-9 rounded-lg hover:bg-muted transition-colors">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        <div className="h-6 w-px bg-border hidden sm:block" />

        <Badge variant="secondary" className="capitalize hidden sm:inline-flex">
          {user.role.replace('_', ' ')}
        </Badge>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline-block">{user.name}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { logout(); toast.info('Signed out', { description: 'You have been signed out.' }); }} title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
