import { describe, it, expect } from 'vitest';
import { describeConversion, type ConvertedTotal } from '@/lib/currency';
import { otherCurrencyNote } from '@/pages/dashboard';
import { buyerCurrencies } from '@/pages/campaigns/detail';
import { clientListParams } from '@/lib/hooks/use-clients';

// Feedback round 1 (Sam, 29 Sep 2026): M3 "only add amounts together after
// converting them to £, and say that they were converted (with the rate and
// date)"; S14 "filters (currency, country, owner)".

const converted: ConvertedTotal = {
  amount: 50_155,
  currency: 'GBP',
  // 1 GBP = 1.1657 EUR → €1 = £0.8579
  rates: [{ currency: 'EUR', rate: 1.1657, rateDate: '2026-09-28', source: 'ECB via Frankfurter' }],
  parts: [{ currency: 'GBP', total: 20_250, gbp: 20_250 }, { currency: 'EUR', total: 34_860, gbp: 29_905 }],
};

describe('describeConversion', () => {
  it('names the source, the date and the per-unit rate', () => {
    const s = describeConversion(converted);
    expect(s).toContain('ECB');
    expect(s).not.toContain('Frankfurter');
    expect(s).toContain('28 Sept 2026'.replace('Sept', new Date('2026-09-28').toLocaleDateString('en-GB', { month: 'short' })));
    expect(s).toContain('€1 = £0.8579');
  });

  it('lists every currency converted', () => {
    const s = describeConversion({ ...converted, rates: [...converted.rates, { currency: 'PLN', rate: 5.0976, rateDate: '2026-09-28', source: 'ECB' }] });
    expect(s).toContain('€1 = £0.8579');
    expect(s).toMatch(/1 = £0\.1962/);
  });

  it('says nothing when nothing was converted', () => {
    expect(describeConversion({ ...converted, rates: [] })).toBe('');
  });
});

describe('otherCurrencyNote (revenue tiles)', () => {
  it('shows the converted all-in figure WITH rate + date when a rate is known', () => {
    const n = otherCurrencyNote([{ currency: 'EUR', total: 34_860 }], converted)!;
    expect(n).toContain('£50,155');
    expect(n).toContain('incl. €34,860');
    expect(n).toContain('€1 = £0.8579');
  });

  it('keeps "not included" wording when no rate is known', () => {
    expect(otherCurrencyNote([{ currency: 'EUR', total: 34_860 }], null)).toBe('GBP invoices only · not included: €34,860');
  });

  it('is unchanged for GBP-only and older backends', () => {
    expect(otherCurrencyNote([], converted)).toBe('GBP invoices only');
    expect(otherCurrencyNote(undefined)).toBeNull();
  });
});

describe('buyerCurrencies (campaign GBP label)', () => {
  it('lists non-GBP buyer currencies once, sorted', () => {
    expect(buyerCurrencies([{ currency: 'EUR' }, { currency: 'chf' }, { currency: 'GBP' }, { currency: 'EUR' }, { currency: null }])).toEqual(['CHF', 'EUR']);
  });
  it('is empty for GBP-only or no buyers', () => {
    expect(buyerCurrencies([{ currency: 'GBP' }])).toEqual([]);
    expect(buyerCurrencies(undefined)).toEqual([]);
  });
});

describe('clientListParams addedBy (S14)', () => {
  it('sends the Added by filter to list + CSV', () => {
    expect(clientListParams({ addedBy: 'unknown' }).get('addedBy')).toBe('unknown');
    expect(clientListParams({ addedBy: 'abc' }, false).get('addedBy')).toBe('abc');
    expect(clientListParams({}).has('addedBy')).toBe(false);
  });
});
