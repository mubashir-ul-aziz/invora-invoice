import { formatCurrency } from '@/domain/business/currency';

/**
 * The one place a money amount is formatted for the invoice PDF (and its
 * in-app preview / share text) — `"€3,000.00"`, the same symbol + thousands
 * separator format every screen in the app uses (`formatCurrency`), so an
 * invoice reads identically in-app and on paper. `currency` is the invoice's
 * own saved currency (`InvoicePdfData.currency`).
 */
export function formatMoney(amount: number, currency: string): string {
  return formatCurrency(amount, currency);
}
