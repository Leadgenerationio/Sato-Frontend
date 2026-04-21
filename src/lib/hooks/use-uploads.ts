import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';

export type UploadFolder = 'invoices' | 'agreements' | 'creatives' | 'landing-pages' | 'misc';

interface PresignInput {
  folder: UploadFolder;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignedUpload {
  uploadUrl: string;
  downloadUrl: string;
  key: string;
  folder: UploadFolder;
  contentType: string;
  sizeBytes: number;
  configured: boolean;
}

type Wrap<T> = { data: T };

async function unwrap<T>(promise: Promise<{ data?: Wrap<T> | T }>): Promise<T> {
  const res = await promise;
  const body = res.data as Wrap<T> | T;
  if (body && typeof body === 'object' && 'data' in (body as Wrap<T>)) return (body as Wrap<T>).data;
  return body as T;
}

export async function fetchPresignedUpload(input: PresignInput): Promise<PresignedUpload> {
  return unwrap(api.post<Wrap<PresignedUpload>>('/api/v1/uploads/presign', input));
}

/** Uploads a single File via signed URL. Skips PUT if mock-mode (URL starts with `mock://`). */
export async function uploadFileToR2(file: File, presigned: PresignedUpload): Promise<void> {
  if (presigned.uploadUrl.startsWith('mock://')) {
    // Backend is not wired to real R2 — skip network call but succeed so dev UX works.
    return;
  }
  const res = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': presigned.contentType },
    body: file,
  });
  if (!res.ok) {
    throw new ApiError(`R2 upload failed: ${res.status}`, res.status);
  }
}

export function useFileUpload() {
  return useMutation<PresignedUpload, Error, { file: File; folder: UploadFolder }>({
    mutationFn: async ({ file, folder }) => {
      const presigned = await fetchPresignedUpload({
        folder,
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      await uploadFileToR2(file, presigned);
      return presigned;
    },
  });
}
