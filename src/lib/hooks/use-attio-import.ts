import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

// #39 Attio bulk import. Two hooks behind the import page:
//   - useBrowseAttio: paginated company list with "already imported" flags
//   - useImportFromAttio: bulk-create with per-row results

export interface BrowseAttioCompany {
  recordId: string;
  name: string | null;
  domain: string | null;
  description: string | null;
  industry: string | null;
  employeeRange: string | null;
  existingClientId: string | null;
}

export interface BrowseResult {
  companies: BrowseAttioCompany[];
  nextCursor: string | null;
}

export function useBrowseAttio(opts: { search?: string; cursor?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.search) params.set('search', opts.search);
  if (opts.cursor) params.set('cursor', opts.cursor);
  const qs = params.toString();
  return useQuery({
    queryKey: ['attio-browse', opts],
    queryFn: async () => {
      const res = await api.get<BrowseResult>(`/api/v1/clients/import/attio/companies${qs ? `?${qs}` : ''}`);
      return unwrap(res);
    },
    // Avoid refetching every focus — the API call is expensive (Attio
    // round-trip) and the data changes slowly.
    staleTime: 30_000,
  });
}

export interface ImportResultRow {
  attioCompanyId: string;
  attioName: string | null;
  status: 'created' | 'skipped' | 'error';
  clientId?: string;
  reason?: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: number;
  rows: ImportResultRow[];
}

export function useImportFromAttio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attioIds: string[]) => {
      const res = await api.post<ImportResult>('/api/v1/clients/import/attio', { attioIds });
      return unwrap(res);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['attio-browse'] });
    },
  });
}
