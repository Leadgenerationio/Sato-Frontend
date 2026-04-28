import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, BookOpen, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useSops, type SopSummary } from '@/lib/hooks/use-sops';
import { EmptyState } from '@/components/shared/empty-state';

const CATEGORY_TABS = ['all', 'operations', 'finance', 'onboarding', 'compliance', 'campaigns'] as const;

const categoryLabels: Record<string, string> = {
  all: 'All',
  operations: 'Operations',
  finance: 'Finance',
  onboarding: 'Onboarding',
  compliance: 'Compliance',
  campaigns: 'Campaigns',
};

const categoryColors: Record<string, string> = {
  Operations: 'bg-blue-500/10 text-blue-600 border-blue-200',
  Finance: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  Onboarding: 'bg-amber-500/10 text-amber-600 border-amber-200',
  Compliance: 'bg-purple-500/10 text-purple-600 border-purple-200',
  Campaigns: 'bg-rose-500/10 text-rose-600 border-rose-200',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SopsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const canWrite = user?.role === 'owner' || user?.role === 'ops_manager';

  const { data, isLoading, error } = useSops({
    category: categoryFilter,
    search,
    limit: 50,
  });
  const sops = data?.sops;

  const handleCategoryChange = (c: string) => { setCategoryFilter(c); };
  const handleSearchChange = (val: string) => { setSearch(val); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="SOPs" description="Standard Operating Procedures library">
        {canWrite && (
          <Link to="/sops/create">
            <Button>
              <Plus className="size-4 mr-1.5" />
              New SOP
            </Button>
          </Link>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleCategoryChange(tab)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                categoryFilter === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {categoryLabels[tab] || tab}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search SOPs..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* SOP Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load SOPs"
          description="Something went wrong reaching the server. Try refreshing the page."
        />
      ) : !sops?.length ? (
        <EmptyState
          icon={BookOpen}
          title="No SOPs yet"
          description="Standard operating procedures help your team work consistently. Document your first one to get started."
          link={{ label: 'New SOP', to: '/sops/create', icon: Plus }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sops.map((sop: SopSummary) => (
            <Card
              key={sop.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => navigate(`/sops/${sop.id}`)}
            >
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-tight line-clamp-2">{sop.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs ${categoryColors[sop.category] || ''}`}>
                      {sop.category}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      v{sop.version}
                    </Badge>
                    {sop.status === 'draft' && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Draft
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{sop.author}</span>
                    <span>{formatDate(sop.lastUpdated)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
