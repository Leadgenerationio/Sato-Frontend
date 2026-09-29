import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FileText, CheckCircle2, XCircle, Film } from 'lucide-react';
import { useFileUpload, type UploadFolder, type PresignedUpload } from '@/lib/hooks/use-uploads';
import { checkUploadFile, CREATIVE_ANY_RULE, SERVER_MAX_UPLOAD_MB, type UploadRule } from '@/lib/upload-rules';
import { toast } from 'sonner';

import { logError } from '../../lib/log';
interface Props {
  folder: UploadFolder;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  /**
   * Allowed file types, checked before upload (Sam S9). Defaults to the
   * creative allow-list for folder="creatives"; other folders only get the
   * size cap + executable block-list unless a rule is passed.
   */
  rule?: UploadRule;
  /** Pick several files at once. Defaults to true for folder="creatives". */
  multiple?: boolean;
  /**
   * Called after the file is stored. May be async — it's awaited, and if it
   * throws, the file is marked failed with the thrown message (the file is
   * stored but the record wasn't saved, so a green tick would be a lie).
   */
  onUploaded?: (result: PresignedUpload, file: File) => void | Promise<void>;
  className?: string;
}

interface Item {
  id: number;
  name: string;
  /** Local object URL for image thumbnails (before and after upload). */
  previewUrl: string | null;
  isVideo: boolean;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

let nextId = 1;

export function FileUpload({
  folder,
  accept,
  maxSizeMB = SERVER_MAX_UPLOAD_MB,
  label,
  rule,
  multiple,
  onUploaded,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useFileUpload();
  const [items, setItems] = useState<Item[]>([]);
  const effectiveRule = rule ?? (folder === 'creatives' ? CREATIVE_ANY_RULE : undefined);
  const effectiveMultiple = multiple ?? folder === 'creatives';
  const effectiveAccept = accept ?? effectiveRule?.accept;

  // Release thumbnail object URLs when the component goes away.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => {
    for (const it of itemsRef.current) if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
  }, []);

  const patch = (id: number, p: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const handlePick = () => inputRef.current?.click();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length === 0) return;

    // Reject bad files up front with a reason per file; upload the rest.
    const accepted: File[] = [];
    for (const file of picked) {
      const problem = checkUploadFile(file, maxSizeMB, effectiveRule);
      if (problem) toast.error(problem);
      else accepted.push(file);
    }
    if (accepted.length === 0) return;

    // Previous batch's thumbnails are replaced by this batch.
    for (const it of itemsRef.current) if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    const batch: Array<{ item: Item; file: File }> = accepted.map((file) => ({
      file,
      item: {
        id: nextId++,
        name: file.name,
        previewUrl: file.type.startsWith('image/') && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file) : null,
        isVideo: file.type.startsWith('video/'),
        status: 'uploading',
      },
    }));
    setItems(batch.map((b) => b.item));

    let ok = 0;
    let lastOkName = '';
    let mock = false;
    // Sequential so the caller's onUploaded (which creates the DB record)
    // runs in pick order and one failure doesn't abort the rest.
    for (const { item, file } of batch) {
      let result: PresignedUpload;
      try {
        result = await upload.mutateAsync({ file, folder });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
        patch(item.id, { status: 'error', error: msg });
        toast.error(`${file.name}: ${msg}`);
        continue;
      }
      try {
        await onUploaded?.(result, file);
      } catch (cbErr: unknown) {
        logError('onUploaded callback threw', cbErr);
        const msg = cbErr instanceof Error ? cbErr.message : 'saving it failed. Please try again.';
        patch(item.id, { status: 'error', error: msg });
        toast.error(`${file.name} uploaded, but ${msg}`);
        continue;
      }
      patch(item.id, { status: 'done' });
      ok += 1;
      lastOkName = file.name;
      if (!result.configured) mock = true;
    }

    if (ok === 0) return;
    if (mock) toast.info('Uploaded in test mode — files are not stored.');
    else toast.success(ok === 1 ? `Uploaded ${lastOkName}` : `Uploaded ${ok} files`);
  };

  const isUploading = items.some((it) => it.status === 'uploading');

  return (
    <div className={className} data-testid="file-upload">
      <input
        ref={inputRef}
        type="file"
        accept={effectiveAccept}
        multiple={effectiveMultiple}
        className="hidden"
        onChange={handleChange}
        data-testid="file-upload-input"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handlePick}
        disabled={isUploading}
        data-testid="file-upload-button"
      >
        {isUploading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="size-4" />
            {label ?? (effectiveMultiple ? 'Upload files' : 'Upload file')}
          </>
        )}
      </Button>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5" data-testid="file-upload-items">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 text-xs text-muted-foreground" data-status={it.status}>
              {it.previewUrl ? (
                <img src={it.previewUrl} alt="" className="size-8 shrink-0 rounded object-cover border" data-testid="file-upload-thumb" />
              ) : it.isVideo ? (
                <Film className="size-3.5 shrink-0" />
              ) : (
                <FileText className="size-3.5 shrink-0" />
              )}
              <span className="truncate max-w-[360px]" title={it.name}>{it.name}</span>
              {it.status === 'uploading' && <Loader2 className="size-3.5 shrink-0 animate-spin" aria-label="Uploading" />}
              {it.status === 'done' && <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-label="Uploaded" />}
              {it.status === 'error' && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="size-3.5 shrink-0" /> {it.error ?? 'Upload failed — please retry.'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
