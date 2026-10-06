import { useInfiniteQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

// Settings → API keys → Activity (MCP spec v1.0 §3, Sam's test 16): every call
// made with an API key, newest first. Backend: GET /api/v1/api-keys/activity
// (Sato-Backend #82). Arguments are redacted on the server when the row is
// written.

export interface ApiActivityItem {
  id: string;
  at: string;
  keyId: string | null;
  keyName: string | null;
  owner: string | null;
  agent: string | null;
  transport: 'rest' | 'mcp' | string;
  tool: string | null;
  method: string | null;
  path: string | null;
  status: number | null;
  errorCode: string | null;
  result: unknown;
  args: unknown;
  recordsTouched: Array<{ type: string; id: string }> | null;
  before: unknown;
  after: unknown;
  durationMs: number | null;
  requestId: string | null;
  ip: string | null;
}

export interface ApiActivityFilters {
  keyId?: string;
  transport?: 'rest' | 'mcp';
  outcome?: 'ok' | 'error';
}

interface ActivityPage { items: ApiActivityItem[]; nextCursor: string | null }

export const ACTIVITY_PAGE_SIZE = 50;

export function useApiActivity(filters: ApiActivityFilters) {
  return useInfiniteQuery({
    queryKey: ['api-activity', filters],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: String(ACTIVITY_PAGE_SIZE) });
      for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
      if (pageParam) qs.set('cursor', pageParam);
      const data = unwrap(await api.get<ActivityPage>(`/api/v1/api-keys/activity?${qs.toString()}`));
      return { items: data?.items ?? [], nextCursor: data?.nextCursor ?? null };
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}
