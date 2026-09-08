import type { Payment, PaymentFilter, PaymentInput, PaymentUpdateInput } from '@/domain/payment/types';

/**
 * The only door the state/controller layer is allowed to use to reach
 * payment data. Screens/components never import a concrete repository,
 * Drizzle table, or the sqlite client directly.
 *
 * This repository knows nothing about `InvoiceRepository`/`CustomerRepository`
 * — `PaymentInput` carries the invoice/customer snapshot fields the caller
 * (`paymentStore`) already has from loading the invoice being paid, exactly
 * like `InvoiceRepository` knows nothing about `BusinessRepository`'s
 * numbering. `PaymentTotalsRepository` (see `data/paymentTotals/`) is the
 * abstraction invoice-status calculation and Customer/Invoice screens use to
 * find out "how much has been paid" — they never call this repository
 * directly for that.
 */
export interface PaymentRepository {
  /** Returns payments matching the filter, newest payment date first. */
  list(filter?: PaymentFilter): Promise<Payment[]>;
  /** Convenience for "every payment against this invoice" — used by Invoice Detail's payment summary and `PaymentTotalsRepository`. */
  listByInvoice(invoiceId: string): Promise<Payment[]>;
  /** Returns a single payment, or null if it doesn't exist. */
  getById(id: string): Promise<Payment | null>;
  create(input: PaymentInput): Promise<Payment>;
  /** The invoice/customer snapshot is fixed at creation — see `PaymentUpdateInput`. */
  update(id: string, input: PaymentUpdateInput): Promise<Payment>;
  delete(id: string): Promise<void>;
}
