import type {
  CustomerActivityEntry,
  CustomerActivityFilter,
  CustomerBalanceSummary,
} from '@/domain/customer/types';

/**
 * The only door Customer Detail / Customer History are allowed to use to
 * reach a customer's financial activity. Per `MVP_BUILD_PLAN.md` §6.3,
 * "Customer balance will eventually be calculated from invoices and
 * payments" — this interface is that calculation's abstraction boundary.
 *
 * Today (Phase 5), neither `Invoice` nor `Payment` exist yet, so the
 * repository wired at the composition root is `NullCustomerActivityRepository`
 * — a real, honest implementation that always returns zero/empty, **not** a
 * stored fake balance. Once Phase 6 (Invoices) and Phase 7 (Payments) add
 * their own repositories, a new implementation of *this same interface*
 * (reading real `InvoiceRepository`/`PaymentRepository` data and reducing it
 * with `domain/customer/activity.ts`'s `summarizeActivity`) replaces
 * `NullCustomerActivityRepository` at the composition root — no screen, store,
 * or this interface itself needs to change.
 */
export interface CustomerActivityRepository {
  getSummary(customerId: string): Promise<CustomerBalanceSummary>;
  /** Returns entries newest-first, optionally filtered to just invoices or just payments. */
  getHistory(customerId: string, filter?: CustomerActivityFilter): Promise<CustomerActivityEntry[]>;
}
