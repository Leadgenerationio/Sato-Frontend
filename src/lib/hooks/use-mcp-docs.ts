import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

// The MCP setup guide and the tool table (t23 / p07). The backend serves both
// (GET /api/v1/mcp-docs): the guide is docs/mcp-setup.md, the tools come from
// the live tool definitions, so this page never drifts from what /mcp does.

export interface McpToolDoc {
  name: string;
  summary: string;
  /** null: any key can call it. */
  scope: string | null;
  kind: string;
  required: string[];
  optional: string[];
  idempotencyKey: boolean;
}

export interface McpDocs {
  setup: string;
  intro: string;
  tools: McpToolDoc[];
}

export function useMcpDocs() {
  return useQuery({
    queryKey: ['mcp-docs'],
    queryFn: async () => unwrap(await api.get<McpDocs>('/api/v1/mcp-docs')),
    staleTime: 10 * 60_000,
  });
}
