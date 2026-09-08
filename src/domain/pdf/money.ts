/**
 * The one place a money amount is formatted for the invoice PDF (and its
 * in-app preview) — `"USD 1,000.00"`. Deliberately not `Intl.NumberFormat`
 * with a `currency` style: Hermes' bundled ICU data doesn't reliably cover
 * every currency/locale pairing this app's businesses might use, and a
 * PDF that must "work offline" and never depend on the runtime's locale data
 * should format the same way on every device. Every other money figure in
 * this codebase (`PaymentSummaryCard`, `InvoiceTotalsSummary`, etc.) already
 * uses a plain `.toFixed(2)` for the same reason (see Phase 8's "no currency
 * symbol formatting" known limitation) — this just adds the currency code
 * prefix, since a PDF leaves the app and needs to stand on its own.
 */
export function formatMoney(amount: number, currency: string): string {
  const grouped = Math.abs(amount)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d)\.)/g, ',');
  const sign = amount < 0 ? '-' : '';
  return `${currency} ${sign}${grouped}`.trim();
}
