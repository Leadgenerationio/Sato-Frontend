import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, Search, Download, CheckCircle2, AlertTriangle, Loader2, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useBrowseAttio, useImportFromAttio,
  type ImportResult,
} from '@/lib/hooks/use-attio-import';
import { EmptyState } from '@/components/shared/empty-state';

// #39 Attio bulk import. Page flow:
//   1. Browse Attio companies (search + cursor pagination).
//   2. Tick the ones you want, click "Import N companies".
//   3. Server creates Stato clients, returns per-row results.
//   4. Results panel below the table.

export function ClientImportPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  const browse = useBrowseAttio({ search: search || undefined, cursor });
  const importMutation = useImportFromAttio();

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setCursor(undefined);
    setSelected(new Set());
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    try {
      const result = await importMutation.mutateAsync(Array.from(selected));
      setLastResult(result);
      setSelected(new Set());
      toast.success(`Import done — ${result.created} created, ${result.skipped} skipped, ${result.errors} errored`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      toast.error(msg);
    }
  };

  // Configuration error from the server (503) — surface a friendly state
  // distinct from "Attio responded with no results".
  const notConfigured = browse.error instanceof Error && /not configured/i.test(browse.error.message);

  const visible = browse.data?.companies ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/clients">
          <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
        </Link>
        <PageHeader
          title="Import clients from Attio"
          description="Pick companies in your Attio CRM to bring in as Stato clients."
        />
      </div>

      {notConfigured ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={AlertTriangle}
              title="Attio not configured"
              description="Add ATTIO_API_KEY to the backend environment to enable importing. Once set, this page reads your Attio companies directly."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search + import bar */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <form onSubmit={handleSearch} className="flex flex-1 gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search company name in Attio…"
                    className="pl-9"
                  />
                </div>
                <Button type="submit" variant="outline">Search</Button>
              </form>
              <Button
                onClick={handleImport}
                disabled={selected.size === 0 || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Download className="size-4 mr-1.5" />
                )}
                Import {selected.size > 0 ? selected.size : ''} compan{selected.size === 1 ? 'y' : 'ies'}
              </Button>
            </CardContent>
          </Card>

          {/* Companies table */}
          {browse.isLoading ? (
            <Card>
              <CardContent className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </CardContent>
            </Card>
          ) : browse.error && !notConfigured ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={AlertTriangle}
                  title="Couldn't reach Attio"
                  description={browse.error instanceof Error ? browse.error.message : 'Try refreshing the page.'}
                />
              </CardContent>
            </Card>
          ) : visible.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={Search}
                  title={search ? 'No companies match your search' : 'No companies in Attio'}
                  description={search ? 'Try a different search term.' : 'Add companies in Attio first, then come back here.'}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((c) => {
                        const isImported = !!c.existingClientId;
                        const isSelected = selected.has(c.recordId);
                        return (
                          <TableRow
                            key={c.recordId}
                            className={isImported ? 'opacity-60' : ''}
                          >
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isImported}
                                onChange={() => toggleSelect(c.recordId)}
                                aria-label={`Select ${c.name ?? c.recordId}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{c.name || '(unnamed)'}</TableCell>
                            <TableCell className="text-muted-foreground">{c.domain || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{c.industry || '—'}</TableCell>
                            <TableCell>
                              {isImported ? (
                                <Link
                                  to={`/clients/${c.existingClientId}`}
                                  className="inline-flex items-center text-xs text-positive hover:underline"
                                >
                                  Already imported
                                  <ChevronRight className="size-3 ml-0.5" />
                                </Link>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Importable</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              {browse.data?.nextCursor && (
                <CardContent className="border-t flex items-center justify-between p-3">
                  <p className="text-xs text-muted-foreground">{visible.length} on this page</p>
                  <Button variant="outline" size="sm" onClick={() => setCursor(browse.data!.nextCursor ?? undefined)}>
                    Next page
                  </Button>
                </CardContent>
              )}
            </Card>
          )}

          {/* Results panel after import */}
          {lastResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-positive" />
                  Last import — {lastResult.created} created, {lastResult.skipped} skipped, {lastResult.errors} errored
                </CardTitle>
                <CardDescription>
                  {lastResult.created > 0
                    ? 'Click any "created" row to open the new client and fill in contact + billing details.'
                    : 'No new clients created — see per-row reasons below.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {lastResult.rows.map((r) => (
                    <div
                      key={r.attioCompanyId}
                      className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <Badge
                        className={`text-xs capitalize ${
                          r.status === 'created' ? 'bg-positive/10 text-positive border-positive/30'
                          : r.status === 'skipped' ? 'bg-warning/10 text-warning border-warning/30'
                          : 'bg-negative/10 text-negative border-negative/30'
                        }`}
                      >
                        {r.status}
                      </Badge>
                      <span className="flex-1 truncate">{r.attioName || r.attioCompanyId}</span>
                      {r.reason && <span className="text-xs text-muted-foreground">{r.reason}</span>}
                      {r.clientId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/clients/${r.clientId}`)}
                        >
                          Open
                          <ChevronRight className="size-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
