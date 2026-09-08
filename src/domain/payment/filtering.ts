import type { Payment, PaymentFilter } from './types';

/**
 * Pure search/filter predicate shared by `InMemoryPaymentRepository` (tests
 * that run without SQLite) and the documented contract `SqlitePaymentRepository`
 * reproduces with SQL — one definition of "what counts as a match", same
 * pattern as `domain/invoice/filtering.ts` / `domain/item/filtering.ts`.
 */
export function paymentMatchesFilter(payment: Payment, filter: PaymentFilter): boolean {
  if (filter.customerId && payment.customerId !== filter.customerId) {
    return false;
  }
  if (filter.invoiceId && payment.invoiceId !== filter.invoiceId) {
    return false;
  }
  if (filter.method !== 'all' && payment.method !== filter.method) {
    return false;
  }
  const query = filter.searchText.trim().toLowerCase();
  if (!query) {
    return true;
  }
  const haystack = [payment.invoiceNumber, payment.customerName, payment.reference]
    .filter((value): value is string => !!value)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/** Canonical sort order: newest payment date first, then newest-created as a tiebreaker — mirrors `domain/invoice/filtering.ts`'s `sortInvoices`. */
export function sortPayments(payments: Payment[]): Payment[] {
  return [...payments].sort((a, b) => {
    const byDate = b.paymentDate.localeCompare(a.paymentDate);
    return byDate !== 0 ? byDate : b.createdAt.localeCompare(a.createdAt);
  });
}
