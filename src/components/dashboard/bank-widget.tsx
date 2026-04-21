import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Landmark, Pencil, Check, X } from 'lucide-react';

interface BankAccount {
  id: string;
  name: string;
  label: string;
  balance: number;
  currency: string;
}

const MOCK_ACCOUNTS: BankAccount[] = [
  { id: 'ba-1', name: 'NatWest Business Current', label: 'Operating Account', balance: 42850.30, currency: 'GBP' },
  { id: 'ba-2', name: 'NatWest Business Savings', label: 'VAT Reserve', balance: 18200.00, currency: 'GBP' },
  { id: 'ba-3', name: 'Wise EUR Account', label: 'EU Payments', balance: 5420.50, currency: 'EUR' },
];

function formatCurrency(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

export function BankWidget() {
  const [accounts, setAccounts] = useState(MOCK_ACCOUNTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  function startEdit(account: BankAccount) {
    setEditingId(account.id);
    setEditValue(account.label);
  }

  function saveEdit(id: string) {
    setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, label: editValue } : a));
    setEditingId(null);
  }

  const totalGBP = accounts.filter((a) => a.currency === 'GBP').reduce((sum, a) => sum + a.balance, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Bank Accounts</CardTitle>
            <CardDescription>Synced from Xero</CardDescription>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Landmark className="size-5 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.map((account, i) => (
          <div key={account.id}>
            {i > 0 && <Separator className="mb-3" />}
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                {editingId === account.id ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-7 text-xs"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(account.id)}
                    />
                    <Button variant="ghost" size="icon" className="size-6" onClick={() => saveEdit(account.id)}>
                      <Check className="size-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-6" onClick={() => setEditingId(null)}>
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{account.label}</p>
                    <Button variant="ghost" size="icon" className="size-5" onClick={() => startEdit(account)}>
                      <Pencil className="size-3 text-muted-foreground" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground truncate">{account.name}</p>
              </div>
              <p className="text-sm font-bold tabular-nums ml-3">
                {formatCurrency(account.balance, account.currency)}
              </p>
            </div>
          </div>
        ))}
        <Separator />
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total (GBP)</p>
          <p className="text-base font-bold tabular-nums">{formatCurrency(totalGBP)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
