import { sumInvoiceTotals } from '@/domain/invoice/calculations';
import type { Invoice } from '@/domain/invoice/types';
import type { DashboardInvoiceEntry } from '@/domain/dashboard/types';
import { sumPayments } from '@/domain/payment/calculations';
import type { Payment } from '@/domain/payment/types';

import type { DashboardRepository } from './DashboardRepository';

/**
 * Mock/testing implementation. Builds `DashboardInvoiceEntry[]` from plain
 * in-memory `Invoice`/`Payment` arrays (e.g. seeded straight from
 * `InMemoryInvoiceRepository`/`InMemoryPaymentRepository`'s own seed data),
 * reusing the same centralized `sumInvoiceTotals`/`sumPayments` functions
 * `SqliteDashboardRepository`'s aggregate queries are equivalent to — so the
 * two implementations can never disagree on a number for the same data. A
 * seed array is copied, not shared, so mutating the caller's array afterward
 * can't retroactively change what this repository returns.
 */
export class InMemoryDashboardRepository implements DashboardRepository {
  private readonly invoices: Invoice[];
  private readonly payments: Payment[];

  constructor(invoices: Invoice[] = [], payments: Payment[] = []) {
    this.invoices = [...invoices];
    this.payments = [...payments];
  }

  async getInvoiceEntries(): Promise<DashboardInvoiceEntry[]> {
    return this.invoices.map((invoice) => {
      const { grandTotal } = sumInvoiceTotals(invoice.items);
      const amountPaid = sumPayments(this.payments.filter((payment) => payment.invoiceId === invoice.id));
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
        grandTotal,
        amountPaid,
      };
    });
  }
}
