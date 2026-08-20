import { describe, it, expect } from 'vitest';
import { describeEmailStatus } from '@/components/clients/portal-users-card';

// Sam (2026-08-20): Barry's invite was ACCEPTED by Resend twice and still
// never arrived. The badge must not call that success.
const base = { status: null, failureType: null, failureReason: null, sentAt: null, suspectedFiltered: false };

describe('describeEmailStatus', () => {
  it('flags an accepted-but-unconfirmed invite as NOT delivered (the Barry case)', () => {
    const d = describeEmailStatus({ ...base, status: 'sent', suspectedFiltered: true })!;
    expect(d.label).toBe('Not confirmed delivered');
    expect(d.tone).toContain('amber');
    expect(d.hint).toMatch(/spam or quarantine/i);
  });

  it('suspectedFiltered wins over a raw "sent" status', () => {
    const plain = describeEmailStatus({ ...base, status: 'sent' })!;
    expect(plain.label).toBe('Invite in flight');
    const filtered = describeEmailStatus({ ...base, status: 'sent', suspectedFiltered: true })!;
    expect(filtered.label).not.toBe(plain.label);
  });

  it('reports a genuine delivery as delivered', () => {
    for (const status of ['delivered', 'opened', 'clicked']) {
      expect(describeEmailStatus({ ...base, status })!.label).toBe('Invite delivered');
    }
  });

  it('surfaces the bounce reason so the admin knows WHY', () => {
    const d = describeEmailStatus({
      ...base, status: 'bounced', failureType: 'Permanent', failureReason: 'mailbox unavailable',
    })!;
    expect(d.label).toBe('Invite bounced');
    expect(d.hint).toBe('Permanent: mailbox unavailable');
  });

  it('distinguishes a spam complaint from a bounce', () => {
    expect(describeEmailStatus({ ...base, status: 'complained' })!.label).toBe('Marked as spam');
  });

  it('renders nothing when there is no send on record', () => {
    expect(describeEmailStatus(base)).toBeNull();
    expect(describeEmailStatus({ ...base, status: 'weird_new_status' })).toBeNull();
  });
});
