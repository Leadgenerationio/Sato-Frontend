import { describe, it, expect } from 'vitest';
import { clientStatusLabel, clientStatusWarnings } from '@/lib/client-status';
import { formatCurrencyTotals, groupByCurrency } from '@/lib/currency';
import { bankTotals, isRetiredBankAccount, outstandingTotals } from '@/pages/dashboard';
import type { InvoiceSummary } from '@/lib/hooks/use-invoices';

// Feedback round 1 (29 Sep 2026): M3 (money per currency), M4 (stored status),
// S12 (retired bank account in the total).

describe('client status (M4)', () => {
  it('labels stored statuses as-is', () => {
    expect(clientStatusLabel('active')).toBe('Active');
    expect(clientStatusLabel('paused')).toBe('Paused');
    expect(clientStatusLabel('churned')).toBe('Churned');
  });

  it('warns about a missing agreement / documents only for active clients', () => {
    expect(clientStatusWarnings('active', false, 3)).toEqual(['No signed agreement']);
    expect(clientStatusWarnings('active', true, 0)).toEqual(['No documents']);
    expect(clientStatusWarnings('active', true, 2)).toEqual([]);
    expect(clientStatusWarnings('onboarding', false, 0)).toEqual([]);
    // Unknown document count never yields a false "No documents".
    expect(clientStatusWarnings('active', true, undefined)).toEqual([]);
  });
});

describe('money per currency (M3)', () => {
  it('never adds EUR into GBP', () => {
    const totals = groupByCurrency(
      [{ t: 34860, c: 'EUR' }, { t: 9000, c: 'GBP' }, { t: 7500, c: 'GBP' }],
      (r) => r.t, (r) => r.c,
    );
    expect(totals).toEqual([
      { currency: 'EUR', total: 34860, count: 1 },
      { currency: 'GBP', total: 16500, count: 2 },
    ]);
    expect(formatCurrencyTotals(totals, { maximumFractionDigits: 0 })).toBe('€34,860 · £16,500');
  });

  it('prefers the backend totalsByCurrency', () => {
    const r = outstandingTotals({
      invoices: [], count: 5, totalOutstanding: '58110',
      totalsByCurrency: [{ currency: 'EUR', total: '34860.00', count: 1 }, { currency: 'GBP', total: '23250.00', count: 4 }],
    });
    expect(r).toEqual({ totals: [{ currency: 'EUR', total: 34860 }, { currency: 'GBP', total: 23250 }], partial: false });
  });

  it('falls back to grouping rows on an older backend, flagging truncation', () => {
    const inv = (total: string, currency: string) => ({ total, currency } as unknown as InvoiceSummary);
    const r = outstandingTotals({ invoices: [inv('34860', 'EUR'), inv('9000', 'GBP')], count: 150, totalOutstanding: '43860' });
    expect(r.totals.map((t) => t.currency)).toEqual(['EUR', 'GBP']);
    expect(r.partial).toBe(true);
  });
});

describe('bank totals (S12)', () => {
  const acct = (name: string, currency: string, balance: string) => ({ name, currency, balance, balanceDate: null });

  it('recognises retired accounts', () => {
    expect(isRetiredBankAccount('DO NOT USE - Mettle OLD')).toBe(true);
    expect(isRetiredBankAccount('do not use')).toBe(true);
    expect(isRetiredBankAccount('Mettle')).toBe(false);
  });

  it('excludes retired accounts and keeps currencies apart, GBP first', () => {
    expect(bankTotals([
      acct('Wise EUR', 'EUR', '500'),
      acct('CLINICAL MARKETING S', 'GBP', '62094.77'),
      acct('DO NOT USE - Mettle OLD', 'GBP', '1000000'),
      acct('Capital on Tap', 'GBP', '-6931.77'),
    ])).toEqual([
      { currency: 'GBP', total: 55163, count: 2 },
      { currency: 'EUR', total: 500, count: 1 },
    ]);
  });
});
