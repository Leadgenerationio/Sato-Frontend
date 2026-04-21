import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AgreementStatus = 'sent' | 'delivered' | 'completed' | 'signed' | 'declined' | 'voided';

export interface Agreement {
  id: string;
  clientId: string;
  docusignEnvelopeId: string;
  signerEmail: string;
  signerName: string;
  status: AgreementStatus;
  sentAt: string;
  signedAt?: string | null;
  declinedAt?: string | null;
  declinedReason?: string | null;
  pdfR2Key?: string | null;
  documentUrl?: string | null;
  signedByClient?: boolean | null;
}

type Wrap<T> = { data: T };

async function unwrap<T>(promise: Promise<{ data?: Wrap<T> | T }>): Promise<T> {
  const res = await promise;
  const body = res.data as Wrap<T> | T;
  if (body && typeof body === 'object' && 'data' in (body as Wrap<T>)) return (body as Wrap<T>).data;
  return body as T;
}

export function useAgreements() {
  return useQuery<{ agreements: Agreement[] }>({
    queryKey: ['agreements'],
    queryFn: () => unwrap(api.get<Wrap<{ agreements: Agreement[] }>>('/api/v1/agreements')),
  });
}

export function useClientAgreements(clientId?: string) {
  return useQuery<{ agreements: Agreement[] }>({
    queryKey: ['agreements', 'client', clientId],
    queryFn: () => unwrap(api.get<Wrap<{ agreements: Agreement[] }>>(`/api/v1/clients/${clientId}/agreements`)),
    enabled: !!clientId,
  });
}

export function useAgreement(id?: string, pollInterval?: number) {
  return useQuery<{ agreement: Agreement }>({
    queryKey: ['agreement', id],
    queryFn: () => unwrap(api.get<Wrap<{ agreement: Agreement }>>(`/api/v1/agreements/${id}`)),
    enabled: !!id,
    refetchInterval: pollInterval,
  });
}

export interface SendAgreementInput {
  clientId: string;
  signerEmail: string;
  signerName: string;
  documentBase64: string;
  documentName?: string;
}

export function useSendAgreement() {
  const qc = useQueryClient();
  return useMutation<{ agreement: Agreement }, Error, SendAgreementInput>({
    mutationFn: (input) => unwrap(api.post<Wrap<{ agreement: Agreement }>>('/api/v1/agreements', input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agreements'] });
    },
  });
}

export function useRefreshAgreementStatus() {
  const qc = useQueryClient();
  return useMutation<{ agreement: Agreement }, Error, string>({
    mutationFn: (id) => unwrap(api.post<Wrap<{ agreement: Agreement }>>(`/api/v1/agreements/${id}/refresh-status`)),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['agreements'] });
      qc.invalidateQueries({ queryKey: ['agreement', id] });
    },
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
