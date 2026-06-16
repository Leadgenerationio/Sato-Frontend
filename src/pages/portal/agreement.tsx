import { FileSignature, Eye } from 'lucide-react';
import { usePortalAgreement } from '@/lib/hooks/use-portal';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { Skeleton } from '@/components/ui/skeleton';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Display-only agreement view (Sam 27-May: portal clients can't upload — the
// team manages signing). Restyled to the Statto design (Stato Portal.html).

export function PortalAgreementPage() {
  usePageTitle('Stato — Agreement');
  const { data: agreement, isLoading } = usePortalAgreement();

  if (isLoading || !agreement) {
    return <div className="screen"><Skeleton className="h-[360px] rounded-3xl" style={{ maxWidth: 720 }} /></div>;
  }

  // The backend already resolves the effective signed state (row status,
  // signedAt, or the admin client.agreementSigned override) and returns
  // status='signed' when signed — see portal.service getAgreement. Treat
  // either signal as signed.
  const isSigned = agreement.status === 'signed' || !!agreement.signedAt;

  return (
    <div className="screen">
      <div className="card pad agreement-card">
        <div className="ag-head">
          <span className="pstat-ic lime-ic"><FileSignature className="size-[22px]" /></span>
          <div>
            <h3 className="statto-title">Lead Generation Agreement</h3>
            <p className="lc-sub">{agreement.clientName}</p>
          </div>
          <span className={'pstat-badge ag-badge' + (isSigned ? '' : ' p-warn')}>{isSigned ? 'Active' : 'Pending'}</span>
        </div>

        <div className="ag-terms">
          <div className="ag-term"><span>Status</span><strong>{isSigned ? 'Signed' : 'Awaiting signature'}</strong></div>
          {agreement.signedAt && (
            <div className="ag-term"><span>Signed</span><strong>{formatDate(agreement.signedAt)}</strong></div>
          )}
        </div>

        {agreement.terms && (
          <div className="ag-terms-text">{agreement.terms}</div>
        )}

        <div className="ag-actions">
          {agreement.documentUrl && (
            <a className="btn b-primary b-sm" href={agreement.documentUrl} target="_blank" rel="noopener noreferrer">
              <Eye className="size-[15px]" /> View document
            </a>
          )}
        </div>

        {!isSigned && (
          <p className="lc-sub" style={{ marginTop: 18, color: 'var(--warning)' }}>
            Your agreement is pending signature. Please contact your account manager to complete signing.
          </p>
        )}
      </div>
    </div>
  );
}
