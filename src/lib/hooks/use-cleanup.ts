import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

// Settings → Clean up (Sam feedback round 1, S8 + N6). Owner only.
// Backend: Sato-Backend GET /admin/cleanup, POST /admin/cleanup/apply.

export interface CleanupUser {
  id: string; email: string; name: string; role: string; isActive: boolean;
  isPrimaryOwner: boolean; isYou: boolean; reason: string; preselect: boolean;
}
export interface CleanupRow { id: string; label: string; detail: string | null; reason: string; preselect: boolean }
export interface CleanupContact { id: string; kind: 'contact' | 'client'; label: string; detail: string | null }
export interface CleanupReport {
  owners: CleanupUser[];
  testLogins: CleanupUser[];
  testSos: CleanupRow[];
  testSops: CleanupRow[];
  placeholderStaff: CleanupRow[];
  untrimmedContacts: CleanupContact[];
  /** Optional: an older backend does not send it. Files that are gone from storage (retest R2-1). */
  creativesMissingFile?: CleanupRow[];
  agreementTemplatesCount: number;
}
export type DemoteRole = 'finance_admin' | 'ops_manager' | 'readonly';
export interface CleanupApplyInput {
  deactivateUserIds: string[];
  demoteOwnerIds: Array<{ id: string; role: DemoteRole }>;
  archiveSosIds: string[];
  archiveSopIds: string[];
  archiveStaffIds: string[];
  hideCreativeIds: string[];
  trimContacts: boolean;
}
export interface CleanupApplyResult {
  deactivated: Array<{ id: string; email: string }>;
  demoted: Array<{ id: string; email: string; role: DemoteRole }>;
  archivedSos: number; archivedSops: number; archivedStaff: number; hiddenCreatives?: number;
  trimmedContacts: number; trimmedClients: number;
}

export const CLEANUP_QUERY_KEY = ['admin', 'cleanup'] as const;

export function useCleanupReport() {
  return useQuery({
    queryKey: CLEANUP_QUERY_KEY,
    queryFn: async () => unwrap(await api.get<CleanupReport>('/api/v1/admin/cleanup')),
  });
}

export function useApplyCleanup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CleanupApplyInput) => unwrap(await api.post<CleanupApplyResult>('/api/v1/admin/cleanup/apply', input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLEANUP_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

/** Pure: what one "Apply" will do, in plain words (the confirm dialog + tests). */
export function summariseCleanup(input: CleanupApplyInput, report: CleanupReport): string[] {
  const byId = new Map([...report.owners, ...report.testLogins].map((u) => [u.id, u]));
  const role = (r: DemoteRole) => ({ finance_admin: 'Finance Admin', ops_manager: 'Ops Manager', readonly: 'Readonly' }[r]);
  const lines: string[] = [];
  for (const id of input.deactivateUserIds) lines.push(`Deactivate ${byId.get(id)?.email ?? id} — they can no longer sign in`);
  for (const d of input.demoteOwnerIds) lines.push(`Change ${byId.get(d.id)?.email ?? d.id} from Owner to ${role(d.role)}`);
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  if (input.archiveSosIds.length) lines.push(`Archive ${n(input.archiveSosIds.length, 'SOS entry', 'SOS entries')}`);
  if (input.archiveSopIds.length) lines.push(`Archive ${n(input.archiveSopIds.length, 'SOP', 'SOPs')}`);
  if (input.archiveStaffIds.length) lines.push(`Archive ${n(input.archiveStaffIds.length, 'staff record', 'staff records')}`);
  if (input.hideCreativeIds.length) lines.push(`Hide ${n(input.hideCreativeIds.length, 'creative', 'creatives')} whose file is missing`);
  if (input.trimContacts && report.untrimmedContacts.length) lines.push(`Remove extra spaces from ${n(report.untrimmedContacts.length, 'name', 'names')}`);
  return lines;
}
