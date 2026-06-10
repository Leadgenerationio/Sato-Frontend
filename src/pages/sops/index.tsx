import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus, BookOpen, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useSops, type SopSummary } from '@/lib/hooks/use-sops';
import { useDebounce } from '@/lib/hooks/use-debounce';

const CATEGORY_TABS = ['all', 'operations', 'finance', 'onboarding', 'compliance', 'campaigns'] as const;

const categoryLabels: Record<string, string> = {
  all: 'All',
  operations: 'Operations',
  finance: 'Finance',
  onboarding: 'Onboarding',
  compliance: 'Compliance',
  campaigns: 'Campaigns',
};

// Statto pill variant per SOP category.
const categoryPill: Record<string, string> = {
  Operations: 'infosoft',
  Finance: 'pos',
  Onboarding: 'soft',
  Compliance: 'warn',
  Campaigns: 'gray',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SopsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const canWrite = user?.role === 'owner' || user?.role === 'ops_manager';

  const { data, isLoading, error } = useSops({
    category: categoryFilter,
    search: debouncedSearch,
    limit: 50,
  });
  const sops = data?.sops;

  const handleCategoryChange = (c: string) => { setCategoryFilter(c); };
  const handleSearchChange = (val: string) => { setSearch(val); };

  return (
    <div className="screen-page">
      <div className="page-head">
        <div>
          <h1 className="ahead-title">SOPs</h1>
          <p className="ahead-sub">Standard Operating Procedures library</p>
        </div>
        {canWrite && (
          <div className="page-actions">
            <Link to="/sops/create">
              <button className="btn b-dark b-sm"><Plus className="size-[15px]" /> New SOP</button>
            </Link>
          </div>
        )}
      </div>

      <div className="inv-toolbar">
        <div className="inv-tabs">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab}
              className={'inv-tab' + (categoryFilter === tab ? ' on' : '')}
              onClick={() => handleCategoryChange(tab)}
            >
              {categoryLabels[tab] || tab}
            </button>
          ))}
        </div>
        <div className="inv-search">
          <Search className="size-4" />
          <input placeholder="Search SOPs…" value={search} onChange={(e) => handleSearchChange(e.target.value)} />
        </div>
      </div>

      {/* SOP Cards Grid */}
      {isLoading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg2)' }}>Loading SOPs…</div>
      ) : error ? (
        <div className="ph-screen">
          <span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span>
          <strong>Couldn't load SOPs</strong>
          <p>Something went wrong reaching the server. Try refreshing the page.</p>
        </div>
      ) : !sops?.length ? (
        <div className="ph-screen">
          <span className="ph-screen-ic"><BookOpen className="size-[26px]" /></span>
          <strong>{search || categoryFilter !== 'all' ? 'No matching SOPs' : 'No SOPs yet'}</strong>
          <p>
            {search || categoryFilter !== 'all'
              ? 'Try a different search or category filter.'
              : 'Standard operating procedures help your team work consistently. Document your first one to get started.'}
          </p>
          {!(search || categoryFilter !== 'all') && canWrite && (
            <Link to="/sops/create"><button className="btn b-dark b-sm"><Plus className="size-[15px]" /> New SOP</button></Link>
          )}
        </div>
      ) : (
        <div className="sop-grid">
          {sops.map((sop: SopSummary) => (
            <button
              key={sop.id}
              className="card pad acard sop-card"
              onClick={() => navigate(`/sops/${sop.id}`)}
            >
              <h3 className="sop-title">{sop.title}</h3>
              <div className="sop-tags">
                <span className={'pill p-' + (categoryPill[sop.category] || 'gray')}>{sop.category}</span>
                <span className="sop-ver">v{sop.version}</span>
                {sop.status === 'draft' && <span className="pill p-gray">Draft</span>}
              </div>
              <div className="sop-foot">
                <span className="sop-author">{sop.author}</span>
                <span className="sop-date">{formatDate(sop.lastUpdated)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
