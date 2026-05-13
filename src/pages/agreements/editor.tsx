import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Send, Loader2, PenLine, Calendar, Type, X, Trash2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, unwrap } from '@/lib/api';
import { fetchFreshDownloadUrl, type UploadFolder } from '@/lib/hooks/use-uploads';

// #47-50 PDF editor with drag-place fields (Sam Loom). DocuSign-style flow:
//   1. Caller uploads a PDF via the normal R2 presign endpoint and routes
//      here with the resulting `r2Key` + signer info as query params.
//   2. We download the PDF via a fresh signed URL, render it with react-pdf.
//   3. User picks a field type from the toolbar, then clicks anywhere on
//      the page to drop a field at that point. Fields render as overlay
//      boxes (signature = blue, date = amber, text = neutral) and can be
//      dragged + deleted.
//   4. "Send for signature" POSTs to /api/v1/agreements/send with the
//      r2Key + the placed fields. Backend converts fractional coords to
//      SignNow pixel coords, attaches fields to the document, then sends
//      a role-based invite.
//
// Coordinates are stored as fractions of page width/height (0..1). The
// backend assumes A4 (595×842 pt) when translating to SignNow pixels —
// good enough for service-agreement templates which are all A4.

// pdfjs needs its worker URL configured ONCE per app. We bundle the worker
// via Vite's `?url` import so it ships from our origin (no CDN trust).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — vite-handled URL import
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type FieldType = 'signature' | 'date_signed' | 'text';

interface PlacedField {
  id: string;            // local UI id; not sent to backend
  page: number;          // 1-indexed
  type: FieldType;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  prefillValue?: string;
}

const FIELD_DEFAULTS: Record<FieldType, { widthPct: number; heightPct: number; label: string; icon: typeof PenLine; color: string }> = {
  signature:    { widthPct: 0.25, heightPct: 0.05, label: 'Signature',    icon: PenLine,  color: 'border-blue-400 bg-blue-50/70 text-blue-700' },
  date_signed:  { widthPct: 0.14, heightPct: 0.035, label: 'Date signed', icon: Calendar, color: 'border-amber-400 bg-amber-50/70 text-amber-700' },
  text:         { widthPct: 0.20, heightPct: 0.035, label: 'Text',        icon: Type,     color: 'border-neutral-400 bg-neutral-50/80 text-neutral-700' },
};

function genId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function AgreementEditorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const r2Key = searchParams.get('r2Key') ?? '';
  const r2Folder = (searchParams.get('r2Folder') ?? 'misc') as UploadFolder;
  const clientId = searchParams.get('clientId') ?? '';
  const signerEmail = searchParams.get('signerEmail') ?? '';
  const signerName = searchParams.get('signerName') ?? '';
  const documentName = searchParams.get('documentName') ?? 'Service Agreement.pdf';

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [tool, setTool] = useState<FieldType | null>(null);
  const [fields, setFields] = useState<PlacedField[]>([]);
  const [sending, setSending] = useState(false);

  // Drag state — when set, mousemove on the page moves the field.
  const dragRef = useRef<{ id: string; offsetXPct: number; offsetYPct: number; page: number } | null>(null);

  // Fetch a fresh signed download URL for the source PDF.
  useEffect(() => {
    if (!r2Key) {
      setPdfError('Missing r2Key — open this page from the Send Agreement dialog.');
      return;
    }
    let cancelled = false;
    fetchFreshDownloadUrl(r2Folder, r2Key)
      .then((url) => { if (!cancelled) setPdfUrl(url); })
      .catch((err) => { if (!cancelled) setPdfError(err instanceof Error ? err.message : 'Failed to load PDF'); });
    return () => { cancelled = true; };
  }, [r2Key, r2Folder]);

  const canSend = useMemo(() => {
    return Boolean(clientId && signerEmail && signerName && fields.length > 0 && r2Key && !sending);
  }, [clientId, signerEmail, signerName, fields.length, r2Key, sending]);

  function handlePageClick(e: React.MouseEvent<HTMLDivElement>, pageNumber: number) {
    // Ignore clicks on placed fields (those bubble up but we don't want to add a new one).
    if ((e.target as HTMLElement).dataset.field) return;
    if (!tool) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    const defaults = FIELD_DEFAULTS[tool];
    setFields((prev) => [
      ...prev,
      {
        id: genId(),
        page: pageNumber,
        type: tool,
        // Center the field on the click point.
        xPct: Math.max(0, Math.min(1 - defaults.widthPct, xPct - defaults.widthPct / 2)),
        yPct: Math.max(0, Math.min(1 - defaults.heightPct, yPct - defaults.heightPct / 2)),
        widthPct: defaults.widthPct,
        heightPct: defaults.heightPct,
      },
    ]);
    setTool(null);
  }

  function handleFieldMouseDown(e: React.MouseEvent, field: PlacedField) {
    e.stopPropagation();
    const containerRect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const offsetXPct = (e.clientX - containerRect.left) / containerRect.width - field.xPct;
    const offsetYPct = (e.clientY - containerRect.top) / containerRect.height - field.yPct;
    dragRef.current = { id: field.id, offsetXPct, offsetYPct, page: field.page };
    window.addEventListener('mousemove', handleDocumentDrag);
    window.addEventListener('mouseup', handleDocumentDragEnd);
  }

  function handleDocumentDrag(e: MouseEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    // Find the page container so we can compute relative coords.
    const pageEl = document.querySelector<HTMLDivElement>(`[data-page="${drag.page}"]`);
    if (!pageEl) return;
    const rect = pageEl.getBoundingClientRect();
    const newXPct = (e.clientX - rect.left) / rect.width - drag.offsetXPct;
    const newYPct = (e.clientY - rect.top) / rect.height - drag.offsetYPct;
    setFields((prev) => prev.map((f) => {
      if (f.id !== drag.id) return f;
      return {
        ...f,
        xPct: Math.max(0, Math.min(1 - f.widthPct, newXPct)),
        yPct: Math.max(0, Math.min(1 - f.heightPct, newYPct)),
      };
    }));
  }

  function handleDocumentDragEnd() {
    dragRef.current = null;
    window.removeEventListener('mousemove', handleDocumentDrag);
    window.removeEventListener('mouseup', handleDocumentDragEnd);
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    try {
      await api.post('/api/v1/agreements/send', {
        clientId,
        signerEmail,
        signerName,
        r2SourceKey: r2Key,
        r2SourceFolder: r2Folder,
        documentName,
        fields: fields.map(({ id: _id, ...f }) => f),
      }).then(unwrap);
      toast.success('Agreement sent with placed fields');
      navigate(clientId ? `/clients/${clientId}?tab=onboarding` : '/agreements');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send agreement');
    } finally {
      setSending(false);
    }
  }

  if (pdfError) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link to="/agreements"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
          <PageHeader title="Agreement editor" description="Couldn't load the source PDF" />
        </div>
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm">
            <AlertTriangle className="size-5 text-red-600 shrink-0" />
            <p className="text-muted-foreground">{pdfError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/agreements"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
        <PageHeader title="Agreement editor" description={`Drop signature, date, and text fields onto the PDF before sending to ${signerName || signerEmail}`} />
      </div>

      {/* Toolbar */}
      <Card className="sticky top-16 z-10">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(FIELD_DEFAULTS) as FieldType[]).map((t) => {
              const def = FIELD_DEFAULTS[t];
              const active = tool === t;
              return (
                <Button
                  key={t}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTool(active ? null : t)}
                >
                  <def.icon className="size-4 mr-1.5" />
                  Add {def.label}
                </Button>
              );
            })}
            {tool && (
              <Badge variant="secondary" className="text-xs">
                Click anywhere on the PDF to drop the {FIELD_DEFAULTS[tool].label} box
              </Badge>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {fields.length} field{fields.length === 1 ? '' : 's'} placed
            </span>
            <Button
              onClick={handleSend}
              disabled={!canSend}
              title={!fields.length ? 'Place at least one field before sending' : ''}
            >
              {sending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Send className="size-4 mr-1.5" />}
              Send for signature
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PDF + overlays */}
      <Card>
        <CardContent className="flex flex-col items-center gap-6 bg-muted/30 p-6">
          {!pdfUrl ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
              <Loader2 className="size-4 animate-spin" />
              Loading PDF...
            </div>
          ) : (
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={<div className="text-sm text-muted-foreground py-12">Rendering PDF...</div>}
              error={<div className="text-sm text-red-600 py-12">Couldn't render the PDF — it may be corrupt or password-protected.</div>}
            >
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
                <div
                  key={pageNumber}
                  data-page={pageNumber}
                  className="relative shadow-md mb-6 bg-white"
                  onClick={(e) => handlePageClick(e, pageNumber)}
                  style={{ cursor: tool ? 'crosshair' : 'default' }}
                >
                  <Page pageNumber={pageNumber} width={780} renderAnnotationLayer={false} renderTextLayer={false} />
                  {/* Overlay placed fields for this page */}
                  {fields
                    .filter((f) => f.page === pageNumber)
                    .map((f) => {
                      const def = FIELD_DEFAULTS[f.type];
                      return (
                        <div
                          key={f.id}
                          data-field="1"
                          onMouseDown={(e) => handleFieldMouseDown(e, f)}
                          className={`absolute border-2 rounded-md flex items-center justify-between px-2 text-xs font-medium select-none cursor-move ${def.color}`}
                          style={{
                            left: `${f.xPct * 100}%`,
                            top: `${f.yPct * 100}%`,
                            width: `${f.widthPct * 100}%`,
                            height: `${f.heightPct * 100}%`,
                          }}
                        >
                          <span className="inline-flex items-center gap-1 truncate">
                            <def.icon className="size-3" />
                            {def.label}
                          </span>
                          <button
                            type="button"
                            data-field="1"
                            onClick={(e) => { e.stopPropagation(); removeField(f.id); }}
                            className="shrink-0 hover:bg-white/60 rounded p-0.5"
                            aria-label="Remove field"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              ))}
            </Document>
          )}
        </CardContent>
      </Card>

      {/* Empty-state hint */}
      {pdfUrl && fields.length === 0 && (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3 text-xs text-amber-700 inline-flex items-center gap-2">
          <Trash2 className="size-3.5 opacity-0" />
          Pick a field type from the toolbar, then click on the PDF to drop it. You can drag fields to reposition.
        </div>
      )}
    </div>
  );
}
