import { describe, it, expect } from 'vitest';
import { formatTileCurrency, formatTileNumber } from '../pages/reports/unified';

// Locks in the £1M compact-notation threshold and the no-decimal-below-1M
// behaviour that together stop the value tiles from overflowing.
// Regex matches are case-insensitive on the K/M/B suffix because CLDR/ICU
// versions disagree on casing (Node 20 → "m", Node 22+ / modern browsers → "M");
// either is acceptable as long as the threshold + sign behaviour holds.

describe('formatTileCurrency', () => {
  it('drops the .00 below the compact threshold', () => {
    expect(formatTileCurrency(999_999)).toBe('£999,999');
  });

  it('renders zero as a bare "£0"', () => {
    expect(formatTileCurrency(0)).toBe('£0');
  });

  it('switches to compact notation at exactly £1M', () => {
    expect(formatTileCurrency(1_000_000)).toMatch(/^£1\.?0?[mM]$/);
  });

  it('uses one-decimal compact for mid-range millions', () => {
    expect(formatTileCurrency(4_169_290)).toMatch(/^£4\.2[mM]$/);
  });

  it('keeps the minus sign attached to compact negatives', () => {
    expect(formatTileCurrency(-4_169_290)).toMatch(/^-£4\.2[mM]$/);
  });

  it('formats negative sub-million values without compact', () => {
    expect(formatTileCurrency(-209_750)).toBe('-£209,750');
  });
});

describe('formatTileNumber', () => {
  // Only the compact branch is asserted — the sub-1M branch goes through
  // `toLocaleString()` with no locale arg, so its output depends on the
  // viewer's system locale (en-GB → "999,999", en-IN → "9,99,999") and isn't
  // safe to pin here.
  it('switches to compact notation at 1M', () => {
    expect(formatTileNumber(1_234_567)).toMatch(/^1\.2[mM]$/);
  });

  it('keeps the minus sign attached to compact negatives', () => {
    expect(formatTileNumber(-1_234_567)).toMatch(/^-1\.2[mM]$/);
  });
});
