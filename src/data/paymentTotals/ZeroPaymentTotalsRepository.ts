import type { PaymentTotalsRepository } from './PaymentTotalsRepository';

/**
 * The real implementation wired at the composition root **today**. There is
 * no `Payment` table yet (Phase 7), so every invoice has honestly been paid
 * $0 — not a stub to delete later, the correct answer for "how much has been
 * paid on this invoice" in a codebase state where no payments exist. See the
 * interface doc comment for how Phase 7 replaces it. Mirrors
 * `NullCustomerActivityRepository`'s Phase 5 reasoning.
 */
export class ZeroPaymentTotalsRepository implements PaymentTotalsRepository {
  async getTotalPaid(_invoiceId: string): Promise<number> {
    return 0;
  }

  async getTotalPaidForInvoices(invoiceIds: string[]): Promise<Record<string, number>> {
    return Object.fromEntries(invoiceIds.map((id) => [id, 0]));
  }
}
