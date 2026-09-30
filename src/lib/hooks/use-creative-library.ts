import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { listOf } from '@/lib/hooks/use-integrations-api';

// Creative library + landing pages (Sam feedback round 1, M2 — plan phase 1,
// Sato-Backend docs/creative-library-and-api-plan.md). A creative belongs to
// a client (optionally a campaign); campaign-shared creatives from before the
// library have `shared: true` and no client.

export type CreativePlatform = 'meta' | 'taboola' | 'google' | 'tiktok' | 'manual';
export type CreativeStatus = 'draft' | 'sent_for_approval' | 'approved' | 'rejected' | 'changes_requested';

export interface LibraryCreative {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  platform: CreativePlatform | null;
  platformAdId: string | null;
  platformCreativeId: string | null;
  platformCampaignName: string | null;
  landingPageId: string | null;
  landingPageUrl: string | null;
  headline: string | null;
  bodyText: string | null;
  mediaType: 'image' | 'video' | null;
  contentType: string | null;
  width: number | null;
  height: number | null;
  durationS: number | null;
  sizeBytes: number | null;
  thumbnailUrl: string | null;
  /** Fresh signed URL — minted on every read, never stored. */
  fileUrl: string | null;
  /** Detail endpoint only: the row points at a stored file that is gone from storage (R2-1). */
  fileMissing?: boolean;
  status: CreativeStatus;
  shared: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
  createdAt: string;
}

export interface CreativeFilters {
  clientId?: string;
  platform?: string;
  campaignId?: string;
  landingPageId?: string;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: 'created' | 'last_seen' | 'name';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreativePage {
  creatives: LibraryCreative[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NewCreativeFile {
  r2Key: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  width?: number;
  height?: number;
  durationS?: number;
}

export interface CreateCreativesInput {
  clientId?: string;
  campaignId?: string;
  landingPageUrl?: string;
  files: NewCreativeFile[];
}

export type BulkCreativeAction =
  | { action: 'assign_landing_page'; landingPageId: string }
  | { action: 'move_client'; clientId: string }
  | { action: 'submit_for_approval' };

export interface LandingPage {
  id: string;
  clientId: string;
  clientName: string | null;
  url: string;
  normalisedUrl: string;
  title: string | null;
  screenshotUrl: string | null;
  creativesCount: number;
  createdAt: string;
}

/** Drops empty / "all" values so the query string only carries real filters. */
export function creativeQueryString(f: CreativeFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === '' || v === 'all') continue;
    p.set(k, String(v));
  }
  return p.toString();
}

export function useLibraryCreatives(filters: CreativeFilters) {
  const qs = creativeQueryString(filters);
  return useQuery({
    queryKey: ['library-creatives', qs],
    queryFn: async () => unwrap(await api.get<CreativePage>(`/api/v1/creatives${qs ? `?${qs}` : ''}`)),
    placeholderData: keepPreviousData,
  });
}

export function useLibraryCreative(id: string | null) {
  return useQuery({
    queryKey: ['library-creative', id],
    queryFn: async () => unwrap(await api.get<{ creative: LibraryCreative }>(`/api/v1/creatives/${id}`)).creative,
    enabled: !!id,
  });
}

function useInvalidateLibrary() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['library-creatives'] });
    qc.invalidateQueries({ queryKey: ['library-creative'] });
    qc.invalidateQueries({ queryKey: ['landing-pages'] });
  };
}

/** One entry of POST /creatives when several are sent: saved (created or updated) or refused with a reason. */
type CreateResult =
  | { id: string; created: boolean; creative: LibraryCreative | null }
  | { index: number; status: number; error: string };

export interface CreateCreativesResult {
  creatives: LibraryCreative[];
  /** Files that were already in the library and were updated instead of copied. */
  duplicates: number;
  /** Files the server refused, by position in `files`. */
  failures: Array<{ index: number; message: string }>;
}

/**
 * The upload dialog works in "files"; the API takes `{ creatives: [...] }` with a `mediaType` on each
 * (a single object or `{ creatives }`). Sending `{ files }` was rejected with "Invalid input", so
 * no upload from the dialog was ever saved.
 */
export function toCreativesRequest(input: CreateCreativesInput) {
  return {
    creatives: input.files.map((f) => ({
      clientId: input.clientId,
      campaignId: input.campaignId,
      landingPageUrl: input.landingPageUrl,
      // The uploader has already refused anything that is not an image or video (creativeFileError).
      mediaType: f.contentType.startsWith('video/') ? 'video' : 'image',
      r2Key: f.r2Key,
      name: f.name,
      contentType: f.contentType,
      sizeBytes: f.sizeBytes,
      sha256: f.sha256,
      width: f.width,
      height: f.height,
      durationS: f.durationS,
    })),
  };
}

/** POST /creatives accepts at most this many creatives per request (backend createCreativesBodySchema). */
export const CREATIVES_PER_REQUEST = 50;

export function useCreateLibraryCreatives() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: async (input: CreateCreativesInput): Promise<CreateCreativesResult> => {
      const failures: CreateCreativesResult['failures'] = [];
      const creatives: LibraryCreative[] = [];
      let duplicates = 0;
      // The API takes up to 50 at a time, so a big drop goes in batches. Each batch answers on its
      // own: a refused batch marks only its own files, and earlier batches stay saved.
      for (let start = 0; start < input.files.length; start += CREATIVES_PER_REQUEST) {
        const files = input.files.slice(start, start + CREATIVES_PER_REQUEST);
        const answered = new Set<number>();
        try {
          const data = unwrap(await api.post<{ results?: CreateResult[] }>('/api/v1/creatives', toCreativesRequest({ ...input, files })));
          // Backend createFromBody answers `{ results }` for any `{ creatives: [...] }` body, even one file
          // (the bare `{ creative, created }` shape is only for a single-object body, which we never send).
          const results = Array.isArray(data?.results) ? data.results : [];
          results.forEach((r, i) => {
            // Batch-relative position; ignore an answer for a file already answered.
            const at = 'error' in r && Number.isInteger(r.index) ? r.index : i;
            if (at < 0 || at >= files.length || answered.has(at)) return;
            answered.add(at);
            if ('error' in r) { failures.push({ index: start + at, message: r.error }); return; }
            if (r.creative) creatives.push(r.creative);
            if (!r.created) duplicates += 1;
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Couldn't save the creatives.";
          files.forEach((_, i) => { if (!answered.has(i)) { failures.push({ index: start + i, message }); answered.add(i); } });
        }
        // A 2xx that doesn't answer for every file must never read as "saved".
        files.forEach((_, i) => {
          if (!answered.has(i)) failures.push({ index: start + i, message: 'The server did not confirm this file.' });
        });
      }
      return { creatives, duplicates, failures };
    },
    onSuccess: invalidate,
  });
}

export function useUpdateLibraryCreative() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; clientId?: string | null; campaignId?: string | null; landingPageId?: string | null }) =>
      unwrap(await api.patch<{ creative: LibraryCreative }>(`/api/v1/creatives/${id}`, patch)).creative,
    onSuccess: invalidate,
  });
}

export function useBulkCreatives() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: async ({ ids, ...action }: { ids: string[] } & BulkCreativeAction) =>
      unwrap(await api.post<{ updated: number }>('/api/v1/creatives/bulk', { ids, ...action })),
    onSuccess: invalidate,
  });
}

export function useLandingPages(filters: { clientId?: string; q?: string } = {}) {
  const qs = creativeQueryString(filters);
  return useQuery({
    queryKey: ['landing-pages', qs],
    queryFn: async () => listOf<LandingPage>(unwrap(await api.get<unknown>(`/api/v1/landing-pages${qs ? `?${qs}` : ''}`)), 'landingPages'),
  });
}

export function useCreateLandingPage() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: async (input: { clientId: string; url: string; title?: string }) =>
      unwrap(await api.post<{ landingPage: LandingPage }>('/api/v1/landing-pages', input)).landingPage,
    onSuccess: invalidate,
  });
}

export function useUpdateLandingPage() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; title?: string; url?: string }) =>
      unwrap(await api.patch<{ landingPage: LandingPage }>(`/api/v1/landing-pages/${id}`, patch)).landingPage,
    onSuccess: invalidate,
  });
}

export function useDeleteLandingPage() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/v1/landing-pages/${id}`); },
    onSuccess: invalidate,
  });
}
