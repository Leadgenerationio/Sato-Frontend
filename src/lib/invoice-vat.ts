/**
 * The VAT rate actually charged on an invoice, worked out from its own amounts
 * (the client's rate is no longer always 20%, and it may have changed since).
 * Null when there is no VAT, or when the subtotal is so small that rounded pence
 * make the ratio meaningless (0.01 on 0.03 is not "33.33%").
 *
 * Kept out of vat-treatment.ts on purpose: that file is identical in Sato-Frontend#62
 * and #63 so the two merge cleanly in either order.
 */
export function invoiceVatRate(subtotal: number, vatAmount: number): number | null {
  if (!(vatAmount > 0) || subtotal < 1) return null;
  return Math.round((vatAmount / subtotal) * 10000) / 100;
}
