import { Link } from 'react-router-dom';
import { Globe, Link2 } from 'lucide-react';
import { CreativeLibrary } from '@/components/creatives/creative-library';

// Sam feedback round 1, M2: "/creatives … return Page not found". Every
// client's creatives in one place; per-client view is the Creatives tab on
// the client page.
export function CreativesPage() {
  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Creatives</h1>
          <p className="ahead-sub">Every client's images and videos — search, filter, preview, and link each one to its ad and landing page.</p>
        </div>
        <div className="page-actions">
          <Link to="/landing-pages"><button className="btn b-ghost b-sm"><Globe className="size-[15px]" /> Landing pages</button></Link>
          <Link to="/ad-accounts"><button className="btn b-ghost b-sm"><Link2 className="size-[15px]" /> Link ad accounts</button></Link>
        </div>
      </div>
      <CreativeLibrary />
    </div>
  );
}
