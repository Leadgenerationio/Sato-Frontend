import type { ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/env';
import { useMcpDocs, type McpToolDoc } from '@/lib/hooks/use-mcp-docs';
import './mcp.css';

// Settings → API keys → "How to connect an AI assistant" (t23 / p07): the MCP
// setup guide and every tool, from GET /api/v1/mcp-docs.

/** The guide as served, made ready for this portal: its own title goes (the page has one), the
 *  placeholder host becomes this portal's API, and the link to mcp-tools.md points at the table below. */
export function prepareGuide(markdown: string, apiUrl: string = API_URL) {
  return markdown
    .replace(/^# .*\n+/, '')
    .replace(/https:\/\/<your Stato API host>/g, apiUrl.replace(/\/+$/, ''))
    .replace(/\]\(\.\/mcp-tools\.md\)/g, '](#mcp-tools)');
}

// react-markdown passes its syntax-tree `node` to custom components; keep it off the DOM.
type MdProps<T extends 'table' | 'a'> = ComponentProps<T> & { node?: unknown };
const components = {
  // Wide tables scroll inside their own box instead of the page.
  table: ({ node: _node, ...p }: MdProps<'table'>) => <div className="mcpd-scroll"><table {...p} /></div>,
  a: ({ node: _node, href, ...p }: MdProps<'a'>) =>
    href?.startsWith('http') ? <a href={href} target="_blank" rel="noopener noreferrer" {...p} /> : <a href={href} {...p} />,
};

const Code = ({ xs }: { xs: string[] }) => <>{xs.map((x, i) => <span key={x}>{i ? ', ' : ''}<code>{x}</code></span>)}</>;

function Inputs({ t }: { t: McpToolDoc }) {
  if (!t.required.length && !t.optional.length && !t.idempotencyKey) return <span className="mcpd-muted">none</span>;
  return (
    <>
      {t.required.length > 0 && <div><Code xs={t.required} /></div>}
      {t.optional.length > 0 && <div><span className="mcpd-muted">optional: </span><Code xs={t.optional} /></div>}
      {t.idempotencyKey && <div className="mcpd-muted">takes <code>idempotencyKey</code></div>}
    </>
  );
}

export function McpDocsPage() {
  const { data, isLoading, error } = useMcpDocs();

  return (
    <div className="screen-page">
      <div className="page-head">
        <div className="nc-title-row">
          <Link to="/settings" className="nc-back" title="Back to settings" aria-label="Back to settings"><ArrowLeft className="size-5" aria-hidden /></Link>
          <div>
            <h1 className="ahead-title">Connect an AI assistant (MCP)</h1>
            <p className="ahead-sub">Set up Cursor, Claude or another MCP client with a Stato API key, and every tool it can use.</p>
          </div>
        </div>
      </div>

      {isLoading ? <div className="card pad acard"><Skeleton className="h-64" /></div>
      : error || !data ? (
        <div className="ph-screen"><span className="ph-screen-ic"><AlertTriangle className="size-[26px]" /></span><strong>Couldn't load the guide</strong><p>{error instanceof Error ? error.message : 'Try refreshing the page.'}</p></div>
      ) : (
        <>
          <article className="card pad acard mcpd" data-testid="mcp-guide">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{prepareGuide(data.setup)}</ReactMarkdown>
          </article>

          <section className="card pad acard mcpd" id="mcp-tools" aria-labelledby="mcp-tools-title">
            <h2 id="mcp-tools-title">All tools</h2>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.intro}</ReactMarkdown>
            <div className="mcpd-scroll">
              <table data-testid="mcp-tools">
                <thead><tr><th>Tool</th><th>What it does</th><th>Scope</th><th>Kind</th><th>Inputs</th></tr></thead>
                <tbody>
                  {data.tools.map((t) => (
                    <tr key={t.name}>
                      <td><code>{t.name}</code></td>
                      <td>{t.summary}</td>
                      <td>{t.scope ? <code>{t.scope}</code> : <span className="mcpd-muted">any key</span>}</td>
                      <td>{t.kind}</td>
                      <td><Inputs t={t} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
