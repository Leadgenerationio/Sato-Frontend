import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Clock, ScrollText } from 'lucide-react';
import { usePortalAgreement } from '@/lib/hooks/use-portal';
import { usePageTitle } from '@/lib/hooks/use-page-title';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Sam (2026-05-27 jam-video #2): "the user shouldn't be able to upload a
// document because we're managing this account, so they shouldn't be
// able to upload a document. We should be able to do everything for the
// back end." Portal users see the agreement state only — admin-side
// (clients/detail) keeps the "Mark as signed (external)" override.

export function PortalAgreementPage() {
  usePageTitle('Stato — Agreement');
  const { data: agreement, isLoading } = usePortalAgreement();

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
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-statto-ink">Agreement</h1>
        <p className="text-muted-foreground">Your lead generation service agreement</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-lg ${isSigned ? 'bg-positive-bg' : 'bg-warning-bg'}`}>
                {isSigned ? <CheckCircle2 className="size-5 text-positive" /> : <Clock className="size-5 text-warning" />}
              </div>
              <div>
                <CardTitle className="text-base">Service Agreement</CardTitle>
                <p className="text-sm text-muted-foreground">{agreement.clientName}</p>
              </div>
            </div>
            <Badge className={isSigned ? 'bg-positive-bg text-positive border-positive/30' : 'bg-warning-bg text-warning border-warning/30'}>
              {isSigned ? 'Signed' : 'Pending'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {agreement.signedAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-positive" />
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
              <p className="text-sm text-warning">
                Your agreement is pending signature. Please contact your account manager to complete the signing process.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
