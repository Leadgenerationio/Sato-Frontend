/**
 * Settings → API keys → Activity (MCP spec v1.0 §3, Sam's test 16): every
 * call made with an API key, with key, bot, tool, result and details.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ApiKey } from '@/lib/hooks/use-integrations-api';
import type { ApiActivityFilters, ApiActivityItem } from '@/lib/hooks/use-api-activity';

let pages: Array<{ items: ApiActivityItem[]; nextCursor: string | null }> = [];
let lastFilters: ApiActivityFilters = {};
const fetchNextPage = vi.fn();

vi.mock('@/lib/hooks/use-api-activity', () => ({
  useApiActivity: (f: ApiActivityFilters) => {
    lastFilters = f;
    return { data: { pages }, isLoading: false, error: null, hasNextPage: Boolean(pages[pages.length - 1]?.nextCursor), isFetchingNextPage: false, fetchNextPage };
  },
}));

import { ApiActivitySettings } from '@/components/settings/api-activity-settings';

const item = (over: Partial<ApiActivityItem>): ApiActivityItem => ({
  id: '1', at: '2026-10-06T07:29:29Z', keyId: 'k1', keyName: 'Grok bot', owner: 'Sam Owner', agent: 'Grok Bot', transport: 'mcp',
  tool: 'whoami', method: 'POST', path: '/mcp', status: 200, errorCode: null, result: { outcome: 'ok' }, args: {}, recordsTouched: null,
  before: null, after: null, durationMs: 12, requestId: 'req-1', ip: '::ffff:127.0.0.1', ...over,
});
const keys: ApiKey[] = [
  { id: 'k1', name: 'Grok bot', prefix: 'stk_ab', scopes: ['clients:read'], lastUsedAt: null, revokedAt: null, createdAt: '2026-10-06T07:00:00Z', usage30d: 3 },
  { id: 'k2', name: 'Old uploader', prefix: 'stk_cd', scopes: ['creatives:write'], lastUsedAt: null, revokedAt: '2026-10-01T00:00:00Z', createdAt: '2026-09-01T00:00:00Z', usage30d: 0 },
];

beforeEach(() => {
  lastFilters = {};
  fetchNextPage.mockReset();
  pages = [{
    items: [
      item({ id: '3', tool: 'link_ad_platform_ids', errorCode: 'account_client_mismatch', result: { outcome: 'error' }, args: { accountId: '428', password: '[redacted]' }, recordsTouched: [{ type: 'creative', id: 'c-1' }] }),
      item({ id: '2', transport: 'rest', tool: null, method: 'GET', path: '/api/v1/clients/lookup', agent: 'Grok bot' }),
      item({ id: '1' }),
    ],
    nextCursor: '1',
  }];
});

describe('ApiActivitySettings', () => {
  it('lists each call with what was called, the key, the bot and the outcome', () => {
    render(<ApiActivitySettings keys={keys} />);
    const rows = screen.getAllByTestId('api-activity-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('link_ad_platform_ids')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('account_client_mismatch')).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/Grok bot · Grok Bot · MCP · 12 ms/)).toBeInTheDocument();
    // REST calls show method and path; a bot named like its key is not shown twice.
    expect(within(rows[1]!).getByText('GET /api/v1/clients/lookup')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/Grok bot · REST/)).toBeInTheDocument();
    expect(within(rows[2]!).getByText('OK')).toBeInTheDocument();
  });

  it('opens a row to show the redacted arguments and the records touched', () => {
    render(<ApiActivitySettings keys={keys} />);
    const row = screen.getAllByTestId('api-activity-row')[0]!;
    const toggle = within(row).getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(row).getByText(/"\[redacted\]"/)).toBeInTheDocument();
    expect(within(row).getByText('creative c-1')).toBeInTheDocument();
    expect(within(row).getByText('127.0.0.1')).toBeInTheDocument();
    expect(within(row).getByText('req-1')).toBeInTheDocument();
  });

  it('filters by key, transport and result, and labels revoked keys', () => {
    render(<ApiActivitySettings keys={keys} />);
    const [keySel, viaSel, resultSel] = screen.getAllByRole('combobox');
    expect(within(keySel!).getByRole('option', { name: 'Old uploader (revoked)' })).toBeInTheDocument();
    fireEvent.change(keySel!, { target: { value: 'k1' } });
    fireEvent.change(viaSel!, { target: { value: 'mcp' } });
    fireEvent.change(resultSel!, { target: { value: 'error' } });
    expect(lastFilters).toEqual({ keyId: 'k1', transport: 'mcp', outcome: 'error' });
    fireEvent.change(resultSel!, { target: { value: '' } });
    expect(lastFilters).toEqual({ keyId: 'k1', transport: 'mcp', outcome: undefined });
  });

  it('loads the next page on demand and hides the button on the last page', () => {
    const { rerender } = render(<ApiActivitySettings keys={keys} />);
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    pages = [{ ...pages[0]!, nextCursor: null }];
    rerender(<ApiActivitySettings keys={keys} />);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('says so when nothing matches the filters', () => {
    pages = [{ items: [], nextCursor: null }];
    render(<ApiActivitySettings keys={keys} />);
    expect(screen.getByText('No calls yet')).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('combobox')[2]!, { target: { value: 'error' } });
    expect(screen.getByText('Nothing matches these filters.')).toBeInTheDocument();
  });
});
