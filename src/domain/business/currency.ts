/**
 * Maps a business's stored 3-letter currency code (`BusinessProfile.currency`
 * / `InvoiceSettings.currency`, free-text per `InvoiceSettingsScreen`) to the
 * symbol shown throughout the app's money inputs and totals. Falls back to
 * the code itself (e.g. `"PKR"`) for a currency with no common symbol, and to
 * `"$"` when no currency is known yet (matches `EMPTY_BUSINESS_PROFILE_INPUT`'s
 * `'USD'` default) — so a screen mid-load never flashes a wrong symbol like
 * the previously hard-coded "£".
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CAD: '$',
  AUD: '$',
  NZD: '$',
  SGD: '$',
  HKD: '$',
  MXN: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  PKR: '₨',
  AED: 'د.إ',
  SAR: '﷼',
  ZAR: 'R',
  BRL: 'R$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
};

export function getCurrencySymbol(currency: string | null | undefined): string {
  if (!currency) return '$';
  return CURRENCY_SYMBOLS[currency.trim().toUpperCase()] ?? currency.trim().toUpperCase();
}

/**
 * Formats a money amount for display with the currency's symbol and
 * thousands separators — `formatCurrency(3000, 'EUR')` → `"€3,000.00"`,
 * negatives as `"-€42.50"`. Plain string math rather than `Intl.NumberFormat`
 * for the same reason as `domain/pdf/money.ts`: Hermes' bundled ICU data
 * doesn't reliably cover every currency, and the same amount must read the
 * same on every device. Only formats — never rounds a stored amount.
 */
export function formatCurrency(amount: number, currency: string | null | undefined): string {
  return `${amount < 0 ? '-' : ''}${getCurrencySymbol(currency)}${formatAmount(amount)}`;
}

/** `3000` → `"3,000.00"` — the unsigned, symbol-less half of `formatCurrency`, for layouts that render the symbol separately. */
export function formatAmount(amount: number): string {
  return Math.abs(amount)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
