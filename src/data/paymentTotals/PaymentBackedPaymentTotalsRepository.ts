import type { PaymentRepository } from '@/data/payment/PaymentRepository';
import { sumPayments } from '@/domain/payment/calculations';

import type { PaymentTotalsRepository } from './PaymentTotalsRepository';

/**
 * The real implementation `ZeroPaymentTotalsRepository`'s doc comment
 * predicted: sums actual `Payment` rows per invoice via
 * `domain/payment/calculations.ts`'s `sumPayments` — the same centralized sum
 * every other payment-total consumer in this codebase uses, so "how much has
 * been paid" is never computed two different ways. Replaces
 * `ZeroPaymentTotalsRepository` at the composition root (`data/container.ts`)
 * — no screen, store, or the `PaymentTotalsRepository` interface itself
 * needed to change for this to happen.
 */
export class PaymentBackedPaymentTotalsRepository implements PaymentTotalsRepository {
  constructor(private readonly payments: PaymentRepository) {}

  async getTotalPaid(invoiceId: string): Promise<number> {
    return sumPayments(await this.payments.listByInvoice(invoiceId));
  }

  async getTotalPaidForInvoices(invoiceIds: string[]): Promise<Record<string, number>> {
    const totals: Record<string, number> = Object.fromEntries(invoiceIds.map((id) => [id, 0]));
    if (invoiceIds.length === 0) {
      return totals;
    }
    // Fetches every payment once and groups in JS rather than one query per
    // invoice — fine at the data volumes a small-business, single-device,
    // offline app realistically has (no pagination/virtualization tuning
    // anywhere else in this codebase either, e.g. `SqliteInvoiceRepository.list()`).
    const all = await this.payments.list();
    const byInvoice: Record<string, { amount: number }[]> = {};
    for (const row of all) {
      if (row.invoiceId in totals) {
        (byInvoice[row.invoiceId] ??= []).push(row);
      }
    }
    for (const invoiceId of invoiceIds) {
      totals[invoiceId] = sumPayments(byInvoice[invoiceId] ?? []);
    }
    return totals;
  }
}
