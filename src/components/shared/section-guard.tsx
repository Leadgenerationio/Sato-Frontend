import { useLocation, Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useMySections } from '@/lib/hooks/use-permissions';
import { sectionForPath } from '@/components/layouts/sidebar';

// Role Access Matrix (S7). An Owner can switch a section off for a role; the
// API then answers 403 and the sidebar hides it. Someone who still opens the
// page by URL or bookmark gets a plain explanation here, instead of the
// page's own "couldn't reach the server" error for every request.
export function SectionGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { data: sections } = useMySections(!!user);
  const section = sectionForPath(pathname);

  if (user && sections && section && !sections.includes(section)) {
    return (
      <div className="screen-page">
        <div className="ph-screen" role="status">
          <span className="ph-screen-ic"><Lock className="size-[26px]" aria-hidden="true" /></span>
          <h3>You don't have access to this section</h3>
          <p>An Owner has switched it off for your role. Ask them to change it in Settings → User Management → Role Access Matrix.</p>
          <Link to="/"><button className="btn b-dark b-sm">Go to Dashboard</button></Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
