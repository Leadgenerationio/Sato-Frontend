import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCampaigns } from '@/lib/hooks/use-campaigns';
import {
  useClientCampaigns,
  useLinkClientCampaign,
} from '@/lib/hooks/use-client-campaigns';

interface AddCampaignDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCampaignDialog({ clientId, open, onOpenChange }: AddCampaignDialogProps) {
  const { data: allCampaignsData } = useCampaigns({ status: 'active', limit: 200 });
  const { data: linkedCampaigns } = useClientCampaigns(clientId);
  const linkCampaign = useLinkClientCampaign();

  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [costPerLeadStr, setCostPerLeadStr] = useState('');

  // When the selected campaign changes, pre-fill costPerLead from that campaign's
  // own costPerLead field (if set), so Sam can override per-client if needed.
  useEffect(() => {
    if (!selectedCampaignId || !allCampaignsData) {
      setCostPerLeadStr('');
      return;
    }
    // CampaignSummary doesn't include costPerLead (that lives on CampaignDetail).
    // Leave blank and let Sam fill it in; the backend accepts empty (null = use default).
    setCostPerLeadStr('');
  }, [selectedCampaignId, allCampaignsData]);

  // Reset state when dialog opens fresh
  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedCampaignId('');
      setCostPerLeadStr('');
    }
    onOpenChange(next);
  }

  // Filter out campaigns already linked to this client
  const linkedIds = new Set((linkedCampaigns ?? []).map((c) => c.id));
  const availableCampaigns = (allCampaignsData?.campaigns ?? []).filter(
    (c) => !linkedIds.has(c.id),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCampaignId) {
      toast.error('Please select a campaign');
      return;
    }
    const costPerLead = costPerLeadStr !== '' ? Number(costPerLeadStr) : undefined;
    if (costPerLead !== undefined && (isNaN(costPerLead) || costPerLead < 0)) {
      toast.error('Cost per lead must be a positive number');
      return;
    }
    try {
      await linkCampaign.mutateAsync({ campaignId: selectedCampaignId, clientId, costPerLead });
      const campaignName =
        availableCampaigns.find((c) => c.id === selectedCampaignId)?.name ?? 'Campaign';
      toast.success(`${campaignName} linked to client`);
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to link campaign');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Campaign</DialogTitle>
          <DialogDescription>
            Link an active campaign to this client and set an optional per-client cost per lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-select">Campaign</Label>
            {availableCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No active campaigns available to link. All active campaigns are already linked, or
                there are none yet.
              </p>
            ) : (
              <select
                id="campaign-select"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">— Select a campaign —</option>
                {availableCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.vertical})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cost-per-lead">
              Cost per lead{' '}
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="cost-per-lead"
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 12.50"
              value={costPerLeadStr}
              onChange={(e) => setCostPerLeadStr(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Override the default campaign cost for this client. Leave blank to use the
              campaign&apos;s default.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={linkCampaign.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={linkCampaign.isPending || availableCampaigns.length === 0}
            >
              {linkCampaign.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
              Add Campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
