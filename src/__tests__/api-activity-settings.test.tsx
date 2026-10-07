/**
 * Settings → API keys → Activity (MCP spec v1.0 §3, Sam's test 16): every
 * call made with an API key, with key, bot, tool, result and details.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, within, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiKey } from '@/lib/hooks/use-integrations-api';
import type { ApiActivityFilters, ApiActivityItem } from '@/lib/hooks/use-api-activity';

let pages: Array<{ items: ApiActivityItem[]; nextCursor: string | null }> = [];
let lastFilters: ApiActivityFilters = {};
const fetchNextPage = vi.fn();
const refetch = vi.fn();
const downloadCsv = vi.fn();
const saveBlob = vi.fn();
const render = (ui: ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
let isFetching = false;

vi.mock('@/lib/hooks/use-api-activity', () => ({
  useApiActivity: (f: ApiActivityFilters) => {
    lastFilters = f;
    return { data: { pages }, isLoading: false, error: null, hasNextPage: Boolean(pages[pages.length - 1]?.nextCursor), isFetchingNextPage: false, fetchNextPage, refetch, isFetching };
  },
  downloadApiActivityCsv: (f: ApiActivityFilters) => downloadCsv(f),
}));
vi.mock('@/lib/download', () => ({ saveBlob: (b: Blob, name: string) => saveBlob(b, name) }));

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
  refetch.mockReset();
  downloadCsv.mockReset();
  saveBlob.mockReset();
  isFetching = false;
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

  it("shows one creative's history from a record it touched, and clears it", () => {
    render(<ApiActivitySettings keys={keys} />);
    expect(screen.queryByTestId('api-activity-creative-filter')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getAllByTestId('api-activity-row')[0]!).getAllByRole('button')[0]!);
    expect(screen.getByRole('link', { name: 'Open in library' })).toHaveAttribute('href', '/creatives?creative=c-1');
    fireEvent.click(screen.getByRole('button', { name: "This creative's history" }));
    expect(lastFilters).toEqual({ creativeId: 'c-1' });
    const chip = screen.getByTestId('api-activity-creative-filter');
    expect(chip).toHaveTextContent('History of creative c-1');
    fireEvent.click(within(chip).getByRole('button', { name: 'Show every creative' }));
    expect(lastFilters.creativeId).toBeUndefined();
    expect(screen.queryByTestId('api-activity-creative-filter')).not.toBeInTheDocument();
  });

  it('downloads the filtered list as CSV', async () => {
    const blob = new Blob(['csv']);
    downloadCsv.mockResolvedValue(blob);
    render(<ApiActivitySettings keys={keys} />);
    fireEvent.change(screen.getAllByRole('combobox')[2]!, { target: { value: 'error' } });
    fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(blob, expect.stringMatching(/^api-activity-\d{4}-\d{2}-\d{2}\.csv$/)));
    expect(downloadCsv).toHaveBeenCalledWith({ outcome: 'error' });
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

  it('names the JSON-RPC method for MCP rows without a tool', () => {
    pages = [{
      items: [
        item({ id: '2', tool: null, args: { method: 'tools/list' } }),
        item({ id: '1', tool: null, args: {} }),
      ],
      nextCursor: null,
    }];
    render(<ApiActivitySettings keys={keys} />);
    const rows = screen.getAllByTestId('api-activity-row');
    expect(within(rows[0]!).getByText('MCP tools/list')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('MCP request')).toBeInTheDocument();
  });

  it('refreshes on demand and shows it is busy while fetching', () => {
    const { rerender } = render(<ApiActivitySettings keys={keys} />);
    const button = screen.getByRole('button', { name: /refresh/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(refetch).toHaveBeenCalledTimes(1);
    isFetching = true;
    rerender(<ApiActivitySettings keys={keys} />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /refresh/i })).toHaveAttribute('aria-busy', 'true');
  });

  it('adds the year only to calls from another year', () => {
    const thisYear = new Date().getFullYear();
    pages = [{
      items: [
        item({ id: '2', at: `${thisYear}-03-04T10:00:00Z` }),
        item({ id: '1', at: '2019-03-04T10:00:00Z' }),
      ],
      nextCursor: null,
    }];
    render(<ApiActivitySettings keys={keys} />);
    const rows = screen.getAllByTestId('api-activity-row');
    expect(within(rows[0]!).queryByText(new RegExp(String(thisYear)))).not.toBeInTheDocument();
    expect(within(rows[1]!).getByText(/4 Mar 2019/)).toBeInTheDocument();
  });

  it('says so when nothing matches the filters', () => {
    pages = [{ items: [], nextCursor: null }];
    render(<ApiActivitySettings keys={keys} />);
    expect(screen.getByText('No calls yet')).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('combobox')[2]!, { target: { value: 'error' } });
    expect(screen.getByText('Nothing matches these filters.')).toBeInTheDocument();
  });
});
