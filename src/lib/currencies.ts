// Sam feedback 2026-09-29 (M5): currency offered only GBP / EUR / USD, so
// Swiss and Polish clients couldn't be billed in their own currency. One
// list, used by New Client, Edit Client and New Invoice.

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'GBP', symbol: '£', name: 'British pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss franc' },
  { code: 'PLN', symbol: 'zł', name: 'Polish złoty' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish krone' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech koruna' },
  { code: 'AED', symbol: 'AED', name: 'UAE dirham' },
];

/** "GBP (£)", "CHF", "PLN (zł)" — the label used in every currency select. */
export function currencyLabel(code: string): string {
  const c = CURRENCIES.find((x) => x.code === code);
  if (!c) return code;
  return c.symbol === c.code ? c.code : `${c.code} (${c.symbol})`;
}

/**
 * The options to render for a currency select. A stored code we don't list
 * (older data) is kept as the first option so opening a form never silently
 * changes what's saved.
 */
export function currencyOptions(current?: string | null): CurrencyOption[] {
  if (current && !CURRENCIES.some((c) => c.code === current)) {
    return [{ code: current, symbol: current, name: current }, ...CURRENCIES];
  }
  return CURRENCIES;
}
