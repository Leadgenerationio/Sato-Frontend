/**
 * Settings → MCP setup guide (t23 / p07): the guide and the tool table from
 * GET /api/v1/mcp-docs, with this portal's API host filled in.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { McpDocs } from '@/lib/hooks/use-mcp-docs';

let state: { data?: McpDocs; isLoading: boolean; error: Error | null } = { isLoading: true, error: null };
vi.mock('@/lib/hooks/use-mcp-docs', () => ({ useMcpDocs: () => state }));
vi.mock('@/lib/env', () => ({ API_URL: 'https://api.example.test' }));

import { McpDocsPage, prepareGuide } from '@/pages/settings/mcp';

const docs: McpDocs = {
  setup: [
    '# Connect an AI assistant to Stato (MCP)',
    '',
    'Intro text.',
    '',
    '## 2. Point the assistant at Stato',
    '',
    '- **Endpoint:** `https://<your Stato API host>/mcp`',
    '',
    '```json',
    '{ "mcpServers": { "stato": { "url": "https://<your Stato API host>/mcp" } } }',
    '```',
    '',
    '## Scopes',
    '',
    '| Scope | Lets the key |',
    '| --- | --- |',
    '| `clients:read` | find clients |',
    '',
    '## The tools',
    '',
    'See [mcp-tools.md](./mcp-tools.md) for all of them.',
    '',
  ].join('\n'),
  intro: '2 tools. Every ID is a string.',
  tools: [
    { name: 'upload_asset', summary: 'File an image.', scope: 'creatives:write', kind: 'write', required: [], optional: ['sourceUrl', 'clientId'], idempotencyKey: true },
    { name: 'whoami', summary: 'Shows which API key this is.', scope: null, kind: 'read only', required: [], optional: [], idempotencyKey: false },
  ],
};

const page = () => render(<MemoryRouter><McpDocsPage /></MemoryRouter>);

describe('MCP docs page', () => {
  it('fills in this portal API host, drops the duplicate title and points the tools link at the table', () => {
    const out = prepareGuide(docs.setup, 'https://api.example.test/');
    expect(out).not.toMatch(/^# /m);
    expect(out).not.toContain('<your Stato API host>');
    expect(out).toContain('"url": "https://api.example.test/mcp"');
    expect(out).toContain('](#mcp-tools)');
  });

  it('renders the guide: headings, the config with the real host, and the scopes table', () => {
    state = { data: docs, isLoading: false, error: null };
    page();
    const guide = screen.getByTestId('mcp-guide');
    expect(within(guide).getByRole('heading', { name: '2. Point the assistant at Stato' })).toBeInTheDocument();
    expect(within(guide).queryByRole('heading', { name: /Connect an AI assistant to Stato/ })).not.toBeInTheDocument();
    expect(guide).toHaveTextContent('https://api.example.test/mcp');
    expect(within(guide).getByRole('table')).toHaveTextContent('clients:read');
    expect(within(guide).getByRole('link', { name: 'mcp-tools.md' })).toHaveAttribute('href', '#mcp-tools');
    expect(guide.querySelector('[node]')).toBeNull();
  });

  it('lists every tool with its scope, kind and inputs', () => {
    state = { data: docs, isLoading: false, error: null };
    page();
    const rows = within(screen.getByTestId('mcp-tools')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('upload_asset');
    expect(rows[0]).toHaveTextContent('creatives:write');
    expect(rows[0]).toHaveTextContent('optional: sourceUrl, clientId');
    expect(rows[0]).toHaveTextContent('takes idempotencyKey');
    expect(rows[1]).toHaveTextContent('any key');
    expect(rows[1]).toHaveTextContent('none');
    expect(screen.getByText('2 tools. Every ID is a string.')).toBeInTheDocument();
  });

  it('links in the guide: web links open in a new tab and cannot reach back (noopener, noreferrer); in-page and relative links stay in the page', () => {
    state = { data: { ...docs, setup: [docs.setup, '', 'Docs: [Cursor](https://docs.cursor.com/mcp), [the table](#mcp-tools), [a page](/settings).'].join('\n') }, isLoading: false, error: null };
    page();
    const guide = screen.getByTestId('mcp-guide');
    const web = within(guide).getByRole('link', { name: 'Cursor' });
    expect(web).toHaveAttribute('href', 'https://docs.cursor.com/mcp');
    expect(web).toHaveAttribute('target', '_blank');
    expect(web.getAttribute('rel')).toMatch(/noopener/);
    expect(web.getAttribute('rel')).toMatch(/noreferrer/);
    for (const name of ['the table', 'a page']) {
      const local = within(guide).getByRole('link', { name });
      expect(local).not.toHaveAttribute('target');
      expect(local).not.toHaveAttribute('rel');
    }
  });

  it('does not render raw HTML or javascript: links from the guide', () => {
    state = { data: { ...docs, setup: [docs.setup, '', '<script>window.__pwned = 1</script><iframe src="https://evil.test"></iframe>', '', '[click](javascript:alert(1))'].join('\n') }, isLoading: false, error: null };
    page();
    const guide = screen.getByTestId('mcp-guide');
    expect(guide.querySelector('script, iframe')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    const bad = guide.querySelector('a[href^="javascript:"]');
    expect(bad).toBeNull();
  });

  it('says so when the guide cannot load', () => {
    state = { isLoading: false, error: new Error('Network down') };
    page();
    expect(screen.getByText("Couldn't load the guide")).toBeInTheDocument();
    expect(screen.getByText('Network down')).toBeInTheDocument();
  });
});
