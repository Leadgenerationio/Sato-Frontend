import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Clock, ScrollText, Loader2, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { usePortalAgreement } from '@/lib/hooks/use-portal';
import { useQueryClient } from '@tanstack/react-query';
import { FileUpload } from '@/components/shared/file-upload';
import { useAuth } from '@/components/providers/auth-provider';
import { API_URL } from '@/lib/env';
import type { ApiResponse } from '@/types';
import type { PresignedUpload } from '@/lib/hooks/use-uploads';
import { logError } from '../../lib/log';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Sam (2026-05-27 portal meeting): client_admin can mark the agreement
// as signed externally — uploads the signed PDF + the BE flips the flag
// + records who/when/IP for audit. Replaces the agency-side override as
// the day-to-day path. Standard portal users see the read-only state.
async function markAgreementSignedExternally(
  token: string,
  result: PresignedUpload,
  file: File,
): Promise<{ documentUrl: string }> {
  const res = await fetch(`${API_URL}/api/v1/portal/agreement/external`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      r2Key: result.key,
      fileName: file.name,
      sizeBytes: file.size,
    }),
  });
  const data: ApiResponse<{ documentUrl: string }> = await res.json();
  if (!res.ok || data.status !== 'success' || !data.data) {
    throw new Error(data.message || 'Could not mark the agreement as signed');
  }
  return data.data;
}

export function PortalAgreementPage() {
  const { data: agreement, isLoading } = usePortalAgreement();
  const { user, token } = useAuth();
  const qc = useQueryClient();
  const [finalising, setFinalising] = useState(false);
  const isClientAdmin = user?.role === 'client_admin';

  if (isLoading || !agreement) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  // Backend canonicalizes a fully-signed agreement as status='completed' and
  // sets signedAt at the same moment. The earlier check on status==='signed'
  // never fired because the backend never writes that string — the portal
  // showed "Pending" indefinitely even after the buyer had signed.
  const isSigned = agreement.status === 'completed' || !!agreement.signedAt;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agreement</h1>
        <p className="text-muted-foreground">Your lead generation service agreement</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-lg ${isSigned ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                {isSigned ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Clock className="size-5 text-amber-600" />}
              </div>
              <div>
                <CardTitle className="text-base">Service Agreement</CardTitle>
                <p className="text-sm text-muted-foreground">{agreement.clientName}</p>
              </div>
            </div>
            <Badge className={isSigned ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-amber-500/10 text-amber-600 border-amber-200'}>
              {isSigned ? 'Signed' : 'Pending'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {agreement.signedAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>Signed on {formatDate(agreement.signedAt)}</span>
            </div>
          )}

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-2">Agreement Terms</h3>
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <ScrollText className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">{agreement.terms}</p>
              </div>
            </div>
          </div>

          {!isSigned && (
            <>
              <Separator />
              {/* Sam (2026-05-27 portal meeting): client_admin can mark
                  this signed by uploading the version they've already
                  signed elsewhere. Standard portal users still see the
                  read-only "contact account manager" copy. */}
              {isClientAdmin ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <FileSignature className="size-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-900">Already signed your agreement elsewhere?</p>
                      <p className="mt-1 text-amber-800">
                        Upload the signed PDF here and your portal will mark it as Signed
                        immediately. We'll log the upload (your name + the time) for the record.
                      </p>
                    </div>
                  </div>
                  <FileUpload
                    folder="agreements"
                    accept="application/pdf"
                    maxSizeMB={20}
                    label="Upload signed agreement"
                    onUploaded={async (result, file) => {
                      setFinalising(true);
                      try {
                        await markAgreementSignedExternally(token!, result, file);
                        toast.success('Agreement marked as signed — thanks!');
                        qc.invalidateQueries({ queryKey: ['portal-agreement'] });
                        qc.invalidateQueries({ queryKey: ['portal-dashboard'] });
                      } catch (err) {
                        logError('markAgreementSignedExternally failed', err);
                        toast.error(err instanceof Error ? err.message : 'Upload accepted but could not finalise');
                      } finally {
                        setFinalising(false);
                      }
                    }}
                  />
                  {finalising && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-700">
                      <Loader2 className="size-3 animate-spin" /> Finalising…
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-600">
                  Your agreement is pending signature. Please contact your account manager to complete the signing process.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
