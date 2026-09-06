/**
 * The only door invoice-status calculation (`domain/invoice/status.ts`) and
 * the Invoice List/Detail screens are allowed to use to find out how much of
 * an invoice has been paid. Per `MVP_BUILD_PLAN.md` §6.3 ("Payments are
 * separate, additive records, never a single mutable `amountPaid` field on
 * `Invoice`"), an invoice's amount paid is always a *sum over payment
 * records* — this interface is that sum's abstraction boundary.
 *
 * Today (Phase 6), `Payment` (Phase 7) doesn't exist yet, so the
 * implementation wired at the composition root is `ZeroPaymentTotalsRepository`
 * — a real, honest implementation that always returns zero, **not** a stored
 * fake amount. Once Phase 7 adds a `PaymentRepository`, a new implementation
 * of *this same interface* (summing real payment rows per invoice) replaces
 * `ZeroPaymentTotalsRepository` at the composition root — no screen, store,
 * or this interface itself needs to change. Mirrors
 * `data/customerActivity/CustomerActivityRepository.ts`'s Phase 5 design.
 */
export interface PaymentTotalsRepository {
  getTotalPaid(invoiceId: string): Promise<number>;
  /** Batch form for list screens — avoids one call per row. */
  getTotalPaidForInvoices(invoiceIds: string[]): Promise<Record<string, number>>;
}
