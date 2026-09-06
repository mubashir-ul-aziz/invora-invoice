import type { Invoice, InvoiceFilter, InvoiceInput, InvoiceUpdateInput } from '@/domain/invoice/types';

/**
 * The only door the state/controller layer is allowed to use to reach
 * invoice data. Screens/components never import a concrete repository,
 * Drizzle table, or the sqlite client directly.
 *
 * This repository knows nothing about the `business` row's invoice
 * numbering — `InvoiceInput` deliberately has no `invoiceNumber` field; the
 * caller (`invoiceStore`) reserves the number via
 * `BusinessRepository.reserveNextInvoiceNumber()` first and passes the
 * already-formatted string as `create()`'s first argument. That keeps this
 * repository dependency-free of `BusinessRepository`, same as every other
 * repository in this codebase depending on nothing but its own table(s).
 */
export interface InvoiceRepository {
  /** Returns invoices matching the filter, newest issue date first. */
  list(filter?: InvoiceFilter): Promise<Invoice[]>;
  /** Returns a single invoice (with its line items), or null if it doesn't exist. */
  getById(id: string): Promise<Invoice | null>;
  /** `invoiceNumber` must already be reserved (see the class doc comment above). */
  create(invoiceNumber: string, input: InvoiceInput): Promise<Invoice>;
  /** Customer and invoice type are fixed at creation — see `InvoiceUpdateInput`. */
  update(id: string, input: InvoiceUpdateInput): Promise<Invoice>;
  delete(id: string): Promise<void>;
}
