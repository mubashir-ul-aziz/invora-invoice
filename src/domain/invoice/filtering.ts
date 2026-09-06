import { sumInvoiceTotals } from './calculations';
import type { Invoice, InvoiceFilter } from './types';
import { computeInvoiceStatus } from './status';

/**
 * Pure search+filter predicate shared by `InMemoryInvoiceRepository` (tests
 * that run without SQLite) and the documented contract `SqliteInvoiceRepository`
 * reproduces with SQL — one definition of "what counts as a match", same
 * pattern as `domain/item/filtering.ts` / `domain/customer/filtering.ts`.
 *
 * `amountPaid` is passed in per-invoice (rather than looked up here) so this
 * function stays free of any repository dependency — the caller already has
 * it from `PaymentTotalsRepository`.
 */
export function invoiceMatchesFilter(
  invoice: Invoice,
  amountPaid: number,
  filter: InvoiceFilter,
): boolean {
  if (filter.customerId && invoice.customerId !== filter.customerId) {
    return false;
  }

  const query = filter.searchText.trim().toLowerCase();
  if (query) {
    const haystack = `${invoice.invoiceNumber} ${invoice.customerName}`.toLowerCase();
    if (!haystack.includes(query)) {
      return false;
    }
  }

  if (filter.status !== 'all') {
    const { grandTotal } = sumInvoiceTotals(invoice.items);
    const status = computeInvoiceStatus({ grandTotal, amountPaid, dueDate: invoice.dueDate });
    if (status !== filter.status) {
      return false;
    }
  }

  return true;
}

/** Canonical sort order for the Invoice List screen: newest issue date first, then newest-created as a tiebreaker. */
export function sortInvoices(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => {
    const byIssueDate = b.issueDate.localeCompare(a.issueDate);
    return byIssueDate !== 0 ? byIssueDate : b.createdAt.localeCompare(a.createdAt);
  });
}
