import { useState } from 'react';
import { PageHeader } from '@/components/layouts/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Subscription {
  id: string;
  name: string;
  provider: string;
  cost: number;
  currency: string;
  frequency: 'monthly' | 'yearly';
  category: string;
  nextBillingDate: string;
  status: 'active' | 'cancelled';
}

const MOCK_SUBSCRIPTIONS: Subscription[] = [
  { id: 's-1', name: 'LeadByte', provider: 'LeadByte Ltd', cost: 299, currency: 'GBP', frequency: 'monthly', category: 'Lead Management', nextBillingDate: '2026-05-01', status: 'active' },
  { id: 's-2', name: 'Xero Premium', provider: 'Xero', cost: 42, currency: 'GBP', frequency: 'monthly', category: 'Accounting', nextBillingDate: '2026-05-15', status: 'active' },
  { id: 's-3', name: 'Endole Credits', provider: 'Endole', cost: 150, currency: 'GBP', frequency: 'monthly', category: 'Credit Checks', nextBillingDate: '2026-05-01', status: 'active' },
  { id: 's-4', name: 'Google Workspace', provider: 'Google', cost: 138, currency: 'GBP', frequency: 'yearly', category: 'Productivity', nextBillingDate: '2026-09-01', status: 'active' },
  { id: 's-5', name: 'Slack Business+', provider: 'Slack', cost: 12.50, currency: 'GBP', frequency: 'monthly', category: 'Communication', nextBillingDate: '2026-05-01', status: 'active' },
  { id: 's-6', name: 'Cloudflare R2', provider: 'Cloudflare', cost: 15, currency: 'GBP', frequency: 'monthly', category: 'Infrastructure', nextBillingDate: '2026-05-01', status: 'active' },
  { id: 's-7', name: 'Railway Pro', provider: 'Railway', cost: 20, currency: 'USD', frequency: 'monthly', category: 'Infrastructure', nextBillingDate: '2026-05-01', status: 'active' },
  { id: 's-8', name: 'Vercel Pro', provider: 'Vercel', cost: 20, currency: 'USD', frequency: 'monthly', category: 'Infrastructure', nextBillingDate: '2026-05-01', status: 'active' },
];

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState(MOCK_SUBSCRIPTIONS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string; provider: string; cost: number; currency: string;
    frequency: 'monthly' | 'yearly'; category: string;
  }>({ name: '', provider: '', cost: 0, currency: 'GBP', frequency: 'monthly', category: '' });

  const monthlyCost = subscriptions
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + (s.frequency === 'yearly' ? s.cost / 12 : s.cost), 0);

  const yearlyCost = monthlyCost * 12;

  function handleAdd() {
    if (!form.name || !form.cost) { toast.error('Name and cost required'); return; }
    setSubscriptions((prev) => [...prev, {
      id: `s-${Date.now()}`, ...form, nextBillingDate: new Date(Date.now() + 30 * 86400000).toISOString(), status: 'active' as const,
    }]);
    setForm({ name: '', provider: '', cost: 0, currency: 'GBP', frequency: 'monthly', category: '' });
    setDialogOpen(false);
    toast.success(`${form.name} added`);
  }

  function handleCancel(id: string) {
    setSubscriptions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'cancelled' as const } : s));
    toast.success('Subscription cancelled');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Subscriptions" description="Track recurring software and service costs">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="size-4 mr-1.5" />Add Subscription</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Subscription</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Slack" /></div>
                <div className="space-y-1"><Label>Provider</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="e.g., Slack Inc" /></div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label>Cost</Label><Input type="number" min={0} step={0.01} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></div>
                <div className="space-y-1"><Label>Currency</Label>
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                    <option value="GBP">GBP</option><option value="USD">USD</option><option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="space-y-1"><Label>Frequency</Label>
                  <select
                    value={form.frequency}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'monthly' || v === 'yearly') setForm({ ...form, frequency: v });
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g., Infrastructure" /></div>
              <Button onClick={handleAdd} className="w-full">Add Subscription</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="py-5"><CardContent className="text-center"><p className="text-2xl font-bold tabular-nums">{formatCurrency(monthlyCost)}</p><p className="text-sm text-muted-foreground">Monthly Cost</p></CardContent></Card>
        <Card className="py-5"><CardContent className="text-center"><p className="text-2xl font-bold tabular-nums">{formatCurrency(yearlyCost)}</p><p className="text-sm text-muted-foreground">Annual Cost</p></CardContent></Card>
        <Card className="py-5"><CardContent className="text-center"><p className="text-2xl font-bold">{subscriptions.filter((s) => s.status === 'active').length}</p><p className="text-sm text-muted-foreground">Active Subscriptions</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id} className={sub.status === 'cancelled' ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="font-medium">{sub.name}</div>
                    <div className="text-xs text-muted-foreground">{sub.provider}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{sub.category}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(sub.cost, sub.currency)}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{sub.frequency}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(sub.nextBillingDate)}</TableCell>
                  <TableCell>
                    <Badge className={sub.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-neutral-500/10 text-neutral-500'}>{sub.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {sub.status === 'active' && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => handleCancel(sub.id)}><Trash2 className="size-4 text-muted-foreground" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
