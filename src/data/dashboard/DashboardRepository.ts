import type { DashboardInvoiceEntry } from '@/domain/dashboard/types';

/**
 * The only door the Dashboard is allowed to use to reach invoice/payment
 * numbers. Deliberately narrower than `InvoiceRepository`/`PaymentRepository`:
 * it returns exactly the per-invoice fields `domain/dashboard/calculations.ts`
 * needs (see `DashboardInvoiceEntry`), never a full `Invoice` (with its line
 * items) or the raw `Payment` rows. That's what lets `SqliteDashboardRepository`
 * answer "what does the dashboard show" with two grouped SQL aggregate
 * queries instead of loading every invoice/line-item/payment row into JS —
 * see that class's doc comment. Screens/stores never import a concrete
 * repository directly.
 */
export interface DashboardRepository {
  /** Every invoice's own grand total and amount paid — the raw material `summarizeDashboard()` combines into the dashboard's numbers. */
  getInvoiceEntries(): Promise<DashboardInvoiceEntry[]>;
}
