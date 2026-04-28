import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Image, Video, FileText, Globe, ExternalLink } from 'lucide-react';
import { usePortalCompliance } from '@/lib/hooks/use-portal';

const typeIcons: Record<string, React.ElementType> = {
  image: Image,
  video: Video,
  text: FileText,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PortalCompliancePage() {
  const { data: compliance, isLoading } = usePortalCompliance();

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance</h1>
        <p className="text-muted-foreground">Creatives and landing pages used in your campaigns</p>
      </div>

      {compliance?.map((campaign) => (
        <div key={campaign.campaignName} className="space-y-4">
          <h2 className="text-lg font-semibold">{campaign.campaignName}</h2>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Creatives</CardTitle>
              <CardDescription>{campaign.creatives.length} creative{campaign.creatives.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaign.creatives.map((cr) => {
                const Icon = typeIcons[cr.type] || FileText;
                return (
                  <div key={cr.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{cr.name}</p>
                        <p className="text-xs text-muted-foreground">Uploaded {formatDate(cr.uploadedAt)}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize">{cr.type}</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Landing Pages</CardTitle>
              <CardDescription>{campaign.landingPages.length} page{campaign.landingPages.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaign.landingPages.map((lp) => (
                <div key={lp.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Globe className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-all text-sm font-medium">{lp.url}</p>
                      <p className="text-xs text-muted-foreground">Last checked {formatDate(lp.lastChecked)}</p>
                    </div>
                  </div>
                  <a href={lp.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <ExternalLink className="size-4 text-muted-foreground hover:text-foreground" />
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
