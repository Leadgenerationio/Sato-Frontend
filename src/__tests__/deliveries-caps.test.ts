import { describe, it, expect } from 'vitest';
import { formatCaps } from '../pages/leadbyte/deliveries';

// Sam's 2026-05-15 Loom asked for delivery caps to be visible on the LeadByte
// deliveries page — caps come back on /deliveries from LeadByte but until
// today were dropped on the floor by the UI. The formatter renders the most
// relevant cap inline + the full set as the hover tooltip.
describe('formatCaps', () => {
  it('returns the "No cap" placeholder when caps is undefined', () => {
    expect(formatCaps(undefined)).toEqual({
      primary: 'No cap',
      tooltip: 'No delivery cap configured (unlimited)',
    });
  });

  it('returns "No cap" when caps is empty (all fields absent)', () => {
    expect(formatCaps({}).primary).toBe('No cap');
  });

  it('prefers the tightest window (day) when multiple are set', () => {
    const out = formatCaps({ day: 100, week: 500, month: 2000, total: 10000 });
    expect(out.primary).toBe('100/day');
    // Tooltip preserves the full set, in day → total order.
    expect(out.tooltip).toBe('100/day · 500/week · 2,000/month · 10,000 total');
  });

  it('falls back to the next-tightest window when day is unset', () => {
    expect(formatCaps({ week: 500, total: 10000 }).primary).toBe('500/week');
    expect(formatCaps({ month: 2000 }).primary).toBe('2,000/month');
    expect(formatCaps({ total: 10000 }).primary).toBe('10,000 total');
  });

  it('formats large numbers with locale separators (Sam reads UK formats)', () => {
    expect(formatCaps({ total: 1_000_000 }).primary).toBe('1,000,000 total');
  });
});
