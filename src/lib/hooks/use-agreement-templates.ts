import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { API_URL } from '@/lib/env';

export interface FieldLayoutItem {
  id: string;
  type: 'variable' | 'signature' | 'date_signed' | 'text';
  variableKey?: string;
  text?: string;
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  fontSize?: number;
}

export type FieldLayout = FieldLayoutItem[];

export interface AgreementTemplate {
  id: string;
  name: string;
  description: string | null;
  pdfR2Key: string;
  fieldLayout: FieldLayout;
  signerRole: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useAgreementTemplates() {
  return useQuery({
    queryKey: ['agreement-templates'],
    queryFn: async () => {
      const res = await api.get<{ templates: AgreementTemplate[] }>('/api/v1/agreement-templates');
      return unwrap(res).templates;
    },
  });
}

export function useAgreementTemplate(id: string) {
  return useQuery({
    queryKey: ['agreement-template', id],
    queryFn: async () => {
      const res = await api.get<{ template: AgreementTemplate }>(`/api/v1/agreement-templates/${id}`);
      return unwrap(res).template;
    },
    enabled: !!id,
  });
}

export function useCreateAgreementTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; pdfR2Key: string; signerRole?: string }) => {
      const res = await api.post<{ template: AgreementTemplate }>('/api/v1/agreement-templates', input);
      return unwrap(res).template;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agreement-templates'] }),
  });
}

export function useUpdateAgreementTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; description?: string; fieldLayout?: FieldLayout; signerRole?: string }) => {
      const res = await api.put<{ template: AgreementTemplate }>(`/api/v1/agreement-templates/${id}`, patch);
      return unwrap(res).template;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['agreement-templates'] });
      qc.invalidateQueries({ queryKey: ['agreement-template', vars.id] });
    },
  });
}

export function useArchiveAgreementTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/agreement-templates/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agreement-templates'] }),
  });
}

export function useDuplicateAgreementTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ template: AgreementTemplate }>(`/api/v1/agreement-templates/${id}/duplicate`, {});
      return unwrap(res).template;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agreement-templates'] }),
  });
}

/**
 * Fetch a populated PDF preview. Returns a Blob (binary).
 * Uses raw fetch (not the api client) because the response is binary, not JSON.
 * Token key is 'accessToken' — matches api.ts which reads localStorage.getItem('accessToken')
 * via tryRefresh and stores with localStorage.setItem('accessToken', ...).
 */
export function usePreviewAgreementTemplate() {
  return useMutation({
    mutationFn: async ({ id, clientId, overrides, effectiveDate }: { id: string; clientId: string; overrides?: Record<string, string>; effectiveDate?: string }) => {
      const res = await fetch(`${API_URL}/api/v1/agreement-templates/${id}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
        },
        body: JSON.stringify({ clientId, overrides, effectiveDate }),
      });
      if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
      return await res.blob();
    },
  });
}
