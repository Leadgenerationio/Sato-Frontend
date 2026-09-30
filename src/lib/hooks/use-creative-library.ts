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

export function useCreateLibraryCreatives() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: async (input: CreateCreativesInput) =>
      unwrap(await api.post<{ creatives: LibraryCreative[]; duplicates?: number }>('/api/v1/creatives', input)),
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
