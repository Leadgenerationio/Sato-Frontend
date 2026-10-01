import { Link } from 'react-router-dom';
import { ImageIcon } from 'lucide-react';
import { LandingPagesList } from '@/components/creatives/landing-pages-list';

// Sam feedback round 1, M2: "nowhere to type a landing page URL". Landing
// pages are their own records, per client.
export function LandingPagesPage() {
  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">Landing pages</h1>
          <p className="ahead-sub">Each client's landing pages, stored once per URL, with the creatives that point to them.</p>
        </div>
        <div className="page-actions">
          <Link to="/creatives" className="btn b-ghost b-sm"><ImageIcon className="size-[15px]" /> Creatives</Link>
        </div>
      </div>
      <LandingPagesList />
    </div>
  );
}
