import { describe, it, expect } from 'vitest';
import { assignClient, buildLinkChanges, isChanged, spendByCurrency, accountKey } from '@/lib/ad-account-drafts';
import type { AdAccountRow } from '@/lib/hooks/use-ad-accounts';

// Sam S13: a save sends only rows that changed, and £/€ are never added together.

const row = (over: Partial<AdAccountRow>): AdAccountRow => ({
  platform: 'facebook-ads', platformLabel: 'Facebook', accountId: 'a1', accountName: 'CH Hearing',
  currency: 'GBP', spend: 0, lastSpendDate: null, link: null, campaigns: [], ...over,
});

const linked = row({ accountId: 'a2', link: { clientId: 'c1', clientName: 'Copious', campaignId: 'k1', campaignName: 'Solar', updatedAt: null } });
const unlinked = row({ accountId: 'a1' });

describe('buildLinkChanges', () => {
  it('sends only rows whose draft differs from what is saved', () => {
    const drafts = new Map([
      [accountKey(unlinked), { clientId: 'c9', campaignId: null }],
      [accountKey(linked), { clientId: 'c1', campaignId: 'k1' }], // same as saved
    ]);
    expect(buildLinkChanges([unlinked, linked], drafts)).toEqual([
      { platform: 'facebook-ads', accountId: 'a1', clientId: 'c9', campaignId: null, accountName: 'CH Hearing', currency: 'GBP' },
    ]);
    expect(isChanged(linked, drafts)).toBe(false);
  });

  it('clearing the client removes the link and drops the campaign', () => {
    const drafts = new Map([[accountKey(linked), { clientId: null, campaignId: 'k1' }]]);
    expect(buildLinkChanges([linked], drafts)).toEqual([expect.objectContaining({ accountId: 'a2', clientId: null, campaignId: null })]);
  });
});

describe('assignClient', () => {
  it('sets one client on many rows; keeps the campaign only where the client is unchanged', () => {
    const next = assignClient(new Map(), [unlinked, linked], 'c1');
    expect(next.get(accountKey(unlinked))).toEqual({ clientId: 'c1', campaignId: null });
    expect(next.get(accountKey(linked))).toEqual({ clientId: 'c1', campaignId: 'k1' });
    const moved = assignClient(new Map(), [linked], 'c2');
    expect(moved.get(accountKey(linked))).toEqual({ clientId: 'c2', campaignId: null });
  });
});

describe('spendByCurrency', () => {
  it('keeps each currency separate and skips zero spend', () => {
    expect(spendByCurrency([
      row({ accountId: '1', spend: 1000, currency: 'GBP' }),
      row({ accountId: '2', spend: 250.5, currency: 'EUR' }),
      row({ accountId: '3', spend: 20, currency: null }),
      row({ accountId: '4', spend: 0, currency: 'CHF' }),
    ])).toEqual([{ currency: 'GBP', spend: 1020 }, { currency: 'EUR', spend: 250.5 }]);
  });
});
