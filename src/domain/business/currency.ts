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
