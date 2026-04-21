import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Clock, ScrollText } from 'lucide-react';
import { usePortalAgreement } from '@/lib/hooks/use-portal';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PortalAgreementPage() {
  const { data: agreement, isLoading } = usePortalAgreement();

  if (isLoading || !agreement) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>;
  }

  const isSigned = agreement.status === 'signed';

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
              <p className="text-sm text-amber-600">
                Your agreement is pending signature. Please contact your account manager to complete the signing process.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
