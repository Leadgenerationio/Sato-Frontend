// Shared currency helpers for the client portal.

/**
 * Format a number as currency, crash-proof against bad codes.
 *
 * Intl.NumberFormat throws RangeError on a malformed currency code (empty
 * string, wrong length, non-letters). ad_spend.currency originates from
 * Catchr and isn't guaranteed clean — an unguarded throw crashed the whole
 * managed-client dashboard in production (2026-05-27). Fall back to GBP
 * formatting, then to a plain number, so a bad code can never take a page
 * down. The backend also sanitises, but the UI must be crash-proof regardless.
 */
export function formatCurrency(value: number, currency = 'GBP'): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
  } catch {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
    } catch {
      return value.toFixed(2);
    }
  }
}

/**
 * Cap an extreme percentage for display.
 *
 * When the divisor of a percentage is near zero (e.g. last-period revenue
 * was £0.01 and current is £88), the raw ratio explodes ("+88333.5%") and
 * misleads readers — the £ delta is real and exact, but the % is noise.
 * We clamp display at ±999% and add an arrow so the trend direction is
 * still obvious. The £ values shown elsewhere on the page remain exact.
 *
 * Sam's hard rule (jam-video #3, 2026-05-29): money figures must be real.
 * A capped percentage is a ratio, not a money figure — the underlying £
 * revenue, £ cost, £ delta stay 100% real and exact.
 */
export function formatPercentCapped(
  value: number,
  opts: { decimals?: number; showSign?: boolean; cap?: number } = {},
): string {
  const { decimals = 1, showSign = false, cap = 999 } = opts;
  if (!Number.isFinite(value)) return '—';
  if (value > cap) return `>+${cap}%↑`;
  if (value < -cap) return `<-${cap}%↓`;
  const sign = showSign && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Sum ad-spend rows into one total per currency, preserving first-seen order.
 * Never sums across currencies — a client running ads in more than one
 * currency gets one total line per currency.
 */
export function totalsByCurrency(
  rows: { spend: number; currency: string }[],
): { currency: string; total: number }[] {
  const order: string[] = [];
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!totals.has(r.currency)) order.push(r.currency);
    totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.spend);
  }
  return order.map((currency) => ({ currency, total: totals.get(currency)! }));
}
