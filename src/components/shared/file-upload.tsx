import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { useFileUpload, type UploadFolder, type PresignedUpload } from '@/lib/hooks/use-uploads';
import { toast } from 'sonner';

interface Props {
  folder: UploadFolder;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  onUploaded?: (result: PresignedUpload, file: File) => void;
  className?: string;
}

export function FileUpload({
  folder,
  accept,
  maxSizeMB = 50,
  label,
  onUploaded,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useFileUpload();
  const [uploaded, setUploaded] = useState<{ name: string; key: string } | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large. Max ${maxSizeMB} MB.`);
      e.target.value = '';
      return;
    }
    try {
      const result = await upload.mutateAsync({ file, folder });
      setUploaded({ name: file.name, key: result.key });
      onUploaded?.(result, file);
      if (!result.configured) {
        toast.info('Uploaded in mock mode — R2 credentials not configured.');
      } else {
        toast.success(`Uploaded ${file.name}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
    } finally {
      e.target.value = '';
    }
  };

  const isUploading = upload.isPending;
  const hasError = upload.isError;

  return (
    <div className={className} data-testid="file-upload">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
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
            {label ?? 'Upload file'}
          </>
        )}
      </Button>
      {uploaded && !isUploading && !hasError && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-emerald-600" />
          <FileText className="size-3.5" />
          <span className="truncate max-w-[360px]" title={uploaded.name}>{uploaded.name}</span>
        </div>
      )}
      {hasError && !isUploading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
          <XCircle className="size-3.5" />
          <span>Upload failed — please retry.</span>
        </div>
      )}
    </div>
  );
}
