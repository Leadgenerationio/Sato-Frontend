import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileVideo, ImageIcon, Loader2, UploadCloud, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FilterSelect, type FilterOption } from '@/components/ui/filter-select';
import { fetchPresignedUpload, type PresignedUpload } from '@/lib/hooks/use-uploads';
import { useCreateLibraryCreatives, type NewCreativeFile } from '@/lib/hooks/use-creative-library';
import {
  CREATIVE_ACCEPT, creativeFileError, formatBytes, landingUrlError, mediaTypeOf, readMediaMeta, sha256Hex,
} from '@/lib/creative-files';

// Multi-file drag-and-drop upload for the creative library (M2). Each file is
// checked (images/videos, 50 MB), fingerprinted (SHA-256) and measured in the
// browser, uploaded to storage with its own progress bar, then all the good
// ones are recorded in one POST /creatives. A bad file never blocks the rest.

type Stage = 'ready' | 'hashing' | 'uploading' | 'saving' | 'done' | 'error';
interface Item {
  id: string;
  file: File;
  preview: string | null;
  stage: Stage;
  progress: number;
  error: string | null;
}

const NONE = '__none__';

function putWithProgress(file: File, presigned: PresignedUpload, onProgress: (pct: number) => void): Promise<void> {
  if (presigned.uploadUrl.startsWith('mock://')) { onProgress(100); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presigned.uploadUrl);
    xhr.setRequestHeader('Content-Type', presigned.contentType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage refused the file (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Couldn't reach file storage — check your connection and try again."));
    xhr.send(file);
  });
}

export interface CreativeUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed client (client-detail tab). When absent the user picks one. */
  clientId?: string;
  clientOptions: FilterOption[];
  campaignOptions: FilterOption[];
}

export function CreativeUploader({ open, onOpenChange, clientId, clientOptions, campaignOptions }: CreativeUploaderProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [client, setClient] = useState(clientId ?? NONE);
  const [campaign, setCampaign] = useState(NONE);
  const [landingUrl, setLandingUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const create = useCreateLibraryCreatives();

  useEffect(() => { if (clientId) setClient(clientId); }, [clientId]);
  // Previews are object URLs — release each when its file leaves the list,
  // and all of them when the dialog unmounts.
  const previews = useRef(new Set<string>());
  const release = (url: string | null) => { if (url) { URL.revokeObjectURL(url); previews.current.delete(url); } };
  useEffect(() => () => { previews.current.forEach((u) => URL.revokeObjectURL(u)); previews.current.clear(); }, []);

  const reset = () => { items.forEach((i) => release(i.preview)); setItems([]); setLandingUrl(''); setCampaign(NONE); if (!clientId) setClient(NONE); };

  const addFiles = (list: FileList | File[]) => {
    const next: Item[] = [...list].map((file, n) => {
      const error = creativeFileError(file);
      const preview = !error && mediaTypeOf(file) === 'image' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
      if (preview) previews.current.add(preview);
      return { id: `${Date.now()}-${n}-${file.name}`, file, preview, stage: error ? 'error' : 'ready', progress: 0, error };
    });
    setItems((prev) => [...prev, ...next]);
  };

  const patch = (id: string, p: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id: string) => setItems((prev) => { release(prev.find((i) => i.id === id)?.preview ?? null); return prev.filter((i) => i.id !== id); });

  const ready = items.filter((i) => i.stage === 'ready');
  const lpError = landingUrl.trim() ? landingUrlError(landingUrl) : null;
  const clientMissing = client === NONE;
  const canUpload = ready.length > 0 && !busy && !lpError && !clientMissing;
  const doneCount = items.filter((i) => i.stage === 'done').length;

  const summary = useMemo(() => {
    const bad = items.filter((i) => i.stage === 'error').length;
    return `${items.length} file${items.length === 1 ? '' : 's'}${bad ? ` · ${bad} can't be uploaded` : ''}`;
  }, [items]);

  async function upload() {
    if (!canUpload) return;
    setBusy(true);
    const uploaded: Array<{ id: string; file: NewCreativeFile }> = [];
    for (const item of ready) {
      try {
        patch(item.id, { stage: 'hashing', progress: 0 });
        const [sha256, meta] = await Promise.all([sha256Hex(item.file), readMediaMeta(item.file)]);
        const contentType = item.file.type || (mediaTypeOf(item.file) === 'video' ? 'video/mp4' : 'image/jpeg');
        const presigned = await fetchPresignedUpload({ folder: 'creatives', filename: item.file.name, contentType, sizeBytes: item.file.size });
        patch(item.id, { stage: 'uploading' });
        await putWithProgress(item.file, presigned, (progress) => patch(item.id, { progress }));
        patch(item.id, { stage: 'saving', progress: 100 });
        uploaded.push({ id: item.id, file: { r2Key: presigned.key, name: item.file.name, contentType, sizeBytes: item.file.size, sha256, ...meta } });
      } catch (err) {
        patch(item.id, { stage: 'error', error: `${item.file.name}: ${err instanceof Error ? err.message : 'upload failed'} Nothing was saved for this file.` });
      }
    }
    if (uploaded.length) {
      try {
        const res = await create.mutateAsync({
          clientId: client === NONE ? undefined : client,
          campaignId: campaign === NONE ? undefined : campaign,
          landingPageUrl: landingUrl.trim() || undefined,
          files: uploaded.map((u) => u.file),
        });
        // The server answers per file, so one refused file doesn't mark the others as failed.
        const failed = new Map((res?.failures ?? []).map((f) => [f.index, f.message]));
        uploaded.forEach((u, i) => {
          if (!failed.has(i)) { patch(u.id, { stage: 'done' }); return; }
          const why = failed.get(i)!.trim().replace(/[.!?]?$/, '.');
          patch(u.id, { stage: 'error', error: `${u.file.name}: ${why} The file reached storage but the creative may not have been saved. Remove it and add it again to retry (a file already in the library is updated, not copied).` });
        });
        const saved = uploaded.length - failed.size;
        const dup = res?.duplicates ?? 0;
        if (saved > 0) toast.success(`${saved} creative${saved === 1 ? '' : 's'} saved${dup ? ` (${dup} already in the library — updated, not copied)` : ''}.`);
        if (failed.size > 0) toast.error(`${failed.size} file${failed.size === 1 ? '' : 's'} couldn't be saved${saved > 0 ? '. The others were saved' : ''}.`);
      } catch (err) {
        // The hook reports API errors per file, so this only guards against something unexpected.
        const msg = (err instanceof Error ? err.message : "Couldn't save the creatives").trim().replace(/[.!?]?$/, '.');
        uploaded.forEach((u) => patch(u.id, { stage: 'error', error: `${u.file.name}: ${msg} The file reached storage but the creative may not have been saved. Remove it and add it again to retry (a file already in the library is updated, not copied).` }));
      }
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle>Upload creatives</DialogTitle>
          <DialogDescription>Images and videos, up to 50 MB each. Drop several at once — each is checked and uploaded on its own.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-4 overflow-y-auto" style={{ display: 'grid', gap: 14 }}>
          <div className="crl-filters" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {!clientId && (
              <label className="nc-field" style={{ display: 'grid', gap: 6 }}>
                <span className="nc-label">Client *</span>
                <FilterSelect value={client} options={[{ value: NONE, label: 'Choose a client…' }, ...clientOptions]} onChange={setClient} ariaLabel="Client for these creatives" muted={clientMissing} />
              </label>
            )}
            <label className="nc-field" style={{ display: 'grid', gap: 6 }}>
              <span className="nc-label">Campaign (optional)</span>
              <FilterSelect value={campaign} options={[{ value: NONE, label: 'No campaign' }, ...campaignOptions]} onChange={setCampaign} ariaLabel="Campaign for these creatives" muted={campaign === NONE} />
            </label>
            <label className="nc-field" style={{ display: 'grid', gap: 6 }}>
              <span className="nc-label">Landing page URL (optional)</span>
              <input
                className="nc-input"
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
                placeholder="https://example.com/offer"
                aria-invalid={!!lpError}
                aria-describedby={lpError ? 'crl-lp-err' : undefined}
              />
              {lpError && <span id="crl-lp-err" className="crl-err">{lpError}</span>}
            </label>
          </div>

          <div
            className="crl-drop"
            data-over={over || undefined}
            role="button"
            tabIndex={0}
            aria-label="Choose or drop image and video files"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
          >
            <UploadCloud className="size-7" aria-hidden />
            <strong>Drop images or videos here</strong>
            <span className="ac-sub" style={{ marginTop: 0 }}>or click to choose — several files at once</span>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={CREATIVE_ACCEPT}
              hidden
              data-testid="creative-file-input"
              onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          {items.length > 0 && (
            <>
              <div className="ac-sub" style={{ marginTop: 0 }}>{summary}</div>
              <ul className="crl-files" aria-label="Files to upload">
                {items.map((i) => (
                  <li key={i.id} className="crl-file" data-stage={i.stage}>
                    <span className="crl-mini" aria-hidden>
                      {i.preview ? <img src={i.preview} alt="" /> : mediaTypeOf(i.file) === 'video' ? <FileVideo className="size-5" /> : <ImageIcon className="size-5" />}
                    </span>
                    <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                      <span className="crl-name">{i.file.name}</span>
                      <span className="crl-sub">{formatBytes(i.file.size)} · {stageLabel(i)}</span>
                      {(i.stage === 'uploading' || i.stage === 'saving') && (
                        <span className="crl-bar" role="progressbar" aria-label={`Upload progress for ${i.file.name}`} aria-valuenow={i.progress} aria-valuemin={0} aria-valuemax={100}>
                          <span style={{ width: `${i.progress}%` }} />
                        </span>
                      )}
                      {i.error && <span className="crl-err" role="alert">{i.error}</span>}
                    </div>
                    <span>
                      {i.stage === 'done' ? <CheckCircle2 className="size-5" style={{ color: 'var(--positive)' }} aria-label="Saved" />
                        : i.stage === 'error' ? (
                          <button type="button" className="inv-open" aria-label={`Remove ${i.file.name}`} onClick={() => remove(i.id)}><XCircle className="size-5" style={{ color: 'var(--negative)' }} /></button>
                        ) : busy ? <Loader2 className="size-5 animate-spin" aria-label="Working" />
                        : <button type="button" className="inv-open" aria-label={`Remove ${i.file.name}`} onClick={() => remove(i.id)}><X className="size-4" /></button>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn b-dark b-sm" disabled={!canUpload} onClick={upload}>
            {busy ? <Loader2 className="size-[15px] animate-spin" /> : <UploadCloud className="size-[15px]" />}
            Upload {ready.length || ''} file{ready.length === 1 ? '' : 's'}
          </button>
          <button type="button" className="btn b-ghost b-sm" disabled={busy} onClick={() => { onOpenChange(false); reset(); }}>
            {doneCount ? 'Done' : 'Cancel'}
          </button>
          {clientMissing && ready.length > 0 && <span className="crl-err">Choose the client these creatives belong to.</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function stageLabel(i: Item) {
  switch (i.stage) {
    case 'ready': return 'Ready';
    case 'hashing': return 'Checking…';
    case 'uploading': return `Uploading ${i.progress}%`;
    case 'saving': return 'Saving…';
    case 'done': return 'Saved';
    case 'error': return "Can't upload";
  }
}
