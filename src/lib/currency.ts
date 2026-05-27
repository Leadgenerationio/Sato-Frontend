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
