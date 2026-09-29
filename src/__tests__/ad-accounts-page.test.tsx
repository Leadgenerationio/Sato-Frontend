/**
 * Sam S13 (feedback round 1, 2026-09-29): bulk "link ad accounts to clients
 * and campaigns". Pins: unlinked spend per currency in the banner, bulk
 * assign, and that Save sends only the rows that changed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AdAccountList } from '@/lib/hooks/use-ad-accounts';

const list: AdAccountList = {
  windowDays: 30,
  accounts: [
    { platform: 'facebook-ads', platformLabel: 'Facebook', accountId: '428353095282383', accountName: 'CH Hearing', currency: 'GBP', spend: 14527.53, lastSpendDate: '2026-09-28', link: null, campaigns: [{ campaignId: 'k1', campaignName: 'Hearing Aids (CH)' }] },
    { platform: 'taboola', platformLabel: 'Taboola', accountId: 'lg-willwriting-sc', accountName: 'Hearing Aids Poland', currency: 'EUR', spend: 250.5, lastSpendDate: '2026-09-28', link: null, campaigns: [] },
    { platform: 'google-ads', platformLabel: 'Google', accountId: '111-222-3333', accountName: 'Solar UK', currency: 'GBP', spend: 900, lastSpendDate: '2026-09-27', link: { clientId: 'c2', clientName: 'Yash Test Copious', campaignId: null, campaignName: null, updatedAt: null }, campaigns: [] },
  ],
  options: {
    clients: [
      { id: 'c1', companyName: 'Yash Test Sonova', status: 'active', currency: 'EUR' },
      { id: 'c2', companyName: 'Yash Test Copious', status: 'active', currency: 'GBP' },
    ],
    campaigns: [{ id: 'k1', name: 'Hearing Aids (CH)', status: 'active' }],
  },
  summary: { total: 3, linked: 1, unlinked: 2, totalSpend: 15678.03, unlinkedSpend: 14778.03, unlinkedSpendByCurrency: {} } as AdAccountList['summary'],
};

const mutateAsync = vi.fn();
vi.mock('@/lib/hooks/use-ad-accounts', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-ad-accounts')>('@/lib/hooks/use-ad-accounts');
  return {
    ...actual,
    useAdAccounts: () => ({ data: list, isLoading: false, error: null }),
    useBulkLinkAdAccounts: () => ({ mutateAsync, isPending: false }),
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AdAccountsPage } from '../pages/ad-accounts/index';

function renderPage() {
  return render(<MemoryRouter><AdAccountsPage /></MemoryRouter>);
}

// Desktop table and phone cards are both in the DOM (CSS shows one); scope
// row controls to the one under test. The bulk bar lives outside both.
const table = () => within(screen.getByRole('table'));
const cards = () => within(screen.getByTestId('ad-account-cards'));

async function pick(label: RegExp | string, option: RegExp | string, scope: () => ReturnType<typeof within> = table) {
  fireEvent.click(scope().getByRole('button', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue({ created: 1, updated: 0, removed: 0, unchanged: 0, results: [] });
});

describe('AdAccountsPage', () => {
  it('shows unlinked spend per currency — £ and € never added together', () => {
    renderPage();
    expect(screen.getByTestId('unlinked-banner')).toHaveTextContent("£14,527.53 + €250.50 of ad spend in the last 30 days isn't linked to a client");
  });

  it('defaults to the not-linked accounts, largest spend first', () => {
    renderPage();
    const rows = screen.getAllByTestId('ad-account-row');
    expect(rows.map((r) => within(r).getByText(/CH Hearing|Hearing Aids Poland|Solar UK/).textContent)).toEqual(['CH Hearing', 'Hearing Aids Poland']);
    fireEvent.click(screen.getByRole('tab', { name: /All \(3\)/ }));
    expect(screen.getAllByTestId('ad-account-row')).toHaveLength(3);
  });

  it('saves only the row that changed, with its campaign', async () => {
    renderPage();
    await pick('Client for CH Hearing', 'Yash Test Sonova');
    await pick('Campaign for CH Hearing', 'Hearing Aids (CH)');
    expect(screen.getByTestId('save-bar')).toHaveTextContent('1 unsaved change');
    fireEvent.click(screen.getByRole('button', { name: /Save 1 change/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith([
      { platform: 'facebook-ads', accountId: '428353095282383', clientId: 'c1', campaignId: 'k1', accountName: 'CH Hearing', currency: 'GBP' },
    ]);
  });

  it('assigns one client to several selected accounts at once', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all shown ad accounts' }));
    expect(screen.getByTestId('bulk-bar')).toHaveTextContent('2 selected');
    await pick('Client for selected ad accounts', 'Yash Test Sonova', () => within(screen.getByTestId('bulk-bar')));
    fireEvent.click(screen.getByRole('button', { name: /Apply to 2/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save 2 changes/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const sent = mutateAsync.mock.calls[0][0] as Array<{ accountId: string; clientId: string }>;
    expect(sent.map((l) => [l.accountId, l.clientId])).toEqual([['428353095282383', 'c1'], ['lg-willwriting-sc', 'c1']]);
  });

  it('keeps the campaign picker disabled until a client is chosen', () => {
    renderPage();
    expect(table().getByRole('button', { name: 'Campaign for CH Hearing' })).toBeDisabled();
    expect(cards().getByRole('button', { name: 'Campaign for CH Hearing' })).toBeDisabled();
  });

  it('phone cards carry the same pickers and save the same change', async () => {
    renderPage();
    expect(cards().getAllByRole('listitem')).toHaveLength(2);
    await pick('Client for Hearing Aids Poland', 'Yash Test Copious', cards);
    fireEvent.click(screen.getByRole('button', { name: /Save 1 change/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0]).toEqual([expect.objectContaining({ accountId: 'lg-willwriting-sc', clientId: 'c2', campaignId: null })]);
  });

  it('Discard drops unsaved changes without calling the API', async () => {
    renderPage();
    await pick('Client for CH Hearing', 'Yash Test Copious');
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    expect(screen.queryByTestId('save-bar')).not.toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
