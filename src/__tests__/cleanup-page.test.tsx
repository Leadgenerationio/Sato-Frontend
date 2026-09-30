/**
 * Sam S8 + N6 (feedback round 1, 2026-09-29): Settings → Clean up.
 * Pins: obvious test rows pre-ticked, Owners never pre-ticked, you / the
 * primary Owner can't be selected, the confirm dialog says exactly what will
 * happen, and Apply sends exactly the selection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CleanupReport } from '@/lib/hooks/use-cleanup';
import { summariseCleanup } from '@/lib/hooks/use-cleanup';
import { accessState, endOfDayIso } from '@/pages/users';

const u = (id: string, email: string, extra: Partial<CleanupReport['owners'][number]> = {}) => ({
  id, email, name: email.split('@')[0], role: 'owner', isActive: true, isPrimaryOwner: false, isYou: false,
  reason: 'has full Owner access', preselect: false, ...extra,
});

const report: CleanupReport = {
  owners: [
    u('o-sam', 'sam@leadgeneration.io', { isYou: true, isPrimaryOwner: true, reason: 'primary owner' }),
    u('o-demo', 'demo@stato.app'),
    u('o-yash', 'yash.c@octogle.com'),
  ],
  testLogins: [
    u('o-demo', 'demo@stato.app', { reason: 'demo login', preselect: true }),
    u('t-test', 'test@test.com', { role: 'client_admin', reason: 'email on test.com', preselect: true }),
    u('t-john', 'john@test.com', { role: 'client_admin', reason: 'email on test.com', preselect: true }),
    // Flagged by name only — shown, but NOT pre-ticked (could be a real person).
    u('t-johnr', 'john.real@acme.co.uk', { role: 'ops_manager', name: 'John', reason: 'name "John" looks like a placeholder', preselect: false }),
    // The Owner opening the page, flagged by a test-looking email: never selectable.
    u('o-sam', 'sam@leadgeneration.io', { isYou: true, isPrimaryOwner: true, reason: 'test email address', preselect: false }),
  ],
  testSos: [
    { id: 's1', label: '"testing"', detail: '/clients', reason: 'message looks like a test', preselect: true },
    { id: 's2', label: '"msg"', detail: null, reason: 'message looks like a test', preselect: true },
  ],
  testSops: [{ id: 'p1', label: 'onbording', detail: 'draft', reason: 'misspelt title ("onbording")', preselect: true }],
  placeholderStaff: [
    { id: 'st1', label: 'John', detail: 'john@x.io', reason: 'name looks like a placeholder', preselect: true },
    { id: 'st2', label: 'Priya', detail: 'priya@x.io', reason: 'first name only — check it is a real person', preselect: false },
  ],
  creativesMissingFile: [{ id: 'cr1', label: 'Yash Missing Creative', detail: 'gone/ad.png', reason: 'file is not in storage — it cannot be previewed or downloaded', preselect: true }],
  untrimmedContacts: [{ id: 'c1', kind: 'contact', label: '"Daniel "', detail: 'dan@claim.co.uk' }],
  agreementTemplatesCount: 0,
};

const mutateAsync = vi.fn();
vi.mock('@/lib/hooks/use-cleanup', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks/use-cleanup')>('@/lib/hooks/use-cleanup');
  return {
    ...actual,
    useCleanupReport: () => ({ data: report, isLoading: false, error: null, refetch: vi.fn() }),
    useApplyCleanup: () => ({ mutateAsync, isPending: false }),
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CleanupPage } from '../pages/settings/cleanup';

const renderPage = () => render(<MemoryRouter><CleanupPage /></MemoryRouter>);

describe('Settings → Clean up (S8 + N6)', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ deactivated: [{ id: 't-test', email: 'test@test.com' }], demoted: [], archivedSos: 2, archivedSops: 1, archivedStaff: 1, trimmedContacts: 1, trimmedClients: 0 });
  });

  it('pre-ticks the obvious test logins with their reason', () => {
    renderPage();
    expect((screen.getByLabelText('Deactivate test@test.com') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Deactivate john@test.com') as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByText('email on test.com').length).toBe(2);
  });

  it('does not pre-tick a login flagged only by name, and locks your own login', () => {
    renderPage();
    expect((screen.getByLabelText('Deactivate john.real@acme.co.uk') as HTMLInputElement).checked).toBe(false);
    const own = screen.getByLabelText('Deactivate sam@leadgeneration.io') as HTMLInputElement;
    expect(own.checked).toBe(false);
    expect(own.disabled).toBe(true);
    expect(screen.getByText("This is you — can't be changed here")).toBeTruthy();
  });

  it('lists Owners with "Keep as Owner" by default and locks you', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Owners/ }));
    expect((screen.getByLabelText('New role for yash.c@octogle.com') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByLabelText('New role for sam@leadgeneration.io')).toBeNull();
    expect(screen.getByText('Stays Owner')).toBeTruthy();
  });

  it('only pre-ticks obvious placeholder staff, not a real first-name-only person', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Test data/ }));
    expect((screen.getByLabelText('Archive Staff "John"') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Archive Staff "Priya"') as HTMLInputElement).checked).toBe(false);
  });

  it('lists creatives whose file is missing, pre-ticked, under Test data', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Test data/ }));
    expect(screen.getByText('Creatives with no file')).toBeTruthy();
    expect((screen.getByLabelText('Archive Creatives with no file "Yash Missing Creative"') as HTMLInputElement).checked).toBe(true);
  });

  it('warns when there are no agreement templates', () => {
    renderPage();
    expect(screen.getByText('No agreement templates yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add a template' }).getAttribute('href')).toBe('/agreements/templates');
  });

  it('confirm dialog says exactly what will happen, then Apply sends exactly the selection', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Owners/ }));
    fireEvent.change(screen.getByLabelText('New role for yash.c@octogle.com'), { target: { value: 'ops_manager' } });
    fireEvent.click(screen.getByRole('button', { name: /^Apply/ }));
    const dialog = await screen.findByRole('dialog');
    const text = within(dialog).getByRole('list').textContent ?? '';
    expect(text).toContain('Deactivate test@test.com — they can no longer sign in');
    expect(text).toContain('Change yash.c@octogle.com from Owner to Ops Manager');
    expect(text).toContain('Archive 2 SOS entries');
    expect(text).toContain('Hide 1 creative whose file is missing');
    expect(text).toContain('Remove extra spaces from 1 name');
    fireEvent.click(within(dialog).getByRole('button', { name: /^Apply \d+ change/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0]).toEqual({
      deactivateUserIds: ['o-demo', 't-test', 't-john'],
      demoteOwnerIds: [{ id: 'o-yash', role: 'ops_manager' }],
      archiveSosIds: ['s1', 's2'],
      archiveSopIds: ['p1'],
      archiveStaffIds: ['st1'],
      hideCreativeIds: ['cr1'],
      trimContacts: true,
    });
    expect(await screen.findByText('What changed')).toBeTruthy();
  });

  it('unticking a row removes it from the request', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Deactivate john@test.com'));
    fireEvent.click(screen.getByRole('button', { name: /^Apply/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^Apply \d+ change/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].deactivateUserIds).toEqual(['o-demo', 't-test']);
  });
});

describe('summariseCleanup', () => {
  it('is empty when nothing is selected', () => {
    expect(summariseCleanup({ deactivateUserIds: [], demoteOwnerIds: [], archiveSosIds: [], archiveSopIds: [], archiveStaffIds: [], hideCreativeIds: [], trimContacts: false }, report)).toEqual([]);
  });
});

describe('Users page: Access ends (S8)', () => {
  const now = new Date('2026-09-29T12:00:00Z');
  it('no date reads "No end date"', () => {
    expect(accessState(null, now)).toEqual({ label: 'No end date', expired: false });
  });
  it('a past date is expired, a future one is not', () => {
    expect(accessState('2026-09-01T00:00:00Z', now).expired).toBe(true);
    expect(accessState('2026-12-31T00:00:00Z', now)).toEqual({ label: '31 Dec 2026', expired: false });
  });
  it('a picked day lasts through that whole day', () => {
    const iso = endOfDayIso('2026-10-31');
    expect(new Date(iso).getTime()).toBeGreaterThan(new Date('2026-10-31T12:00:00').getTime());
    expect(new Date(iso).getTime()).toBeLessThan(new Date('2026-11-01T00:00:00').getTime());
  });
});
