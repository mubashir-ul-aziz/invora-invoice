import type { InvoiceRepository } from '@/data/invoice/InvoiceRepository';
import type { PaymentRepository } from '@/data/payment/PaymentRepository';
import type { PaymentTotalsRepository } from '@/data/paymentTotals/PaymentTotalsRepository';
import { filterActivity, sortActivityChronological, summarizeActivity } from '@/domain/customer/activity';
import type { CustomerActivityEntry, CustomerActivityFilter, CustomerBalanceSummary } from '@/domain/customer/types';
import { sumInvoiceTotals } from '@/domain/invoice/calculations';
import { computeInvoiceStatus } from '@/domain/invoice/status';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment/types';

import type { CustomerActivityRepository } from './CustomerActivityRepository';

/**
 * The real implementation Phase 5 predicted: reads this customer's actual
 * invoices (Phase 6) and payments (Phase 7) and reduces them with the exact
 * same `summarizeActivity()` every mock/testing implementation already
 * shares — see the doc comment on `CustomerActivityRepository`. Each
 * invoice's amount paid comes from `PaymentTotalsRepository` (real, once
 * Phase 7's `PaymentBackedPaymentTotalsRepository` is wired in at the
 * composition root); the individual payment rows themselves come from
 * `PaymentRepository`, scoped to this customer the same way invoices are.
 */
export class InvoiceBackedCustomerActivityRepository implements CustomerActivityRepository {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly paymentTotals: PaymentTotalsRepository,
    private readonly payments: PaymentRepository,
  ) {}

  async getSummary(customerId: string): Promise<CustomerBalanceSummary> {
    return summarizeActivity(await this.buildEntries(customerId));
  }

  async getHistory(
    customerId: string,
    filter: CustomerActivityFilter = { type: 'all' },
  ): Promise<CustomerActivityEntry[]> {
    return sortActivityChronological(filterActivity(await this.buildEntries(customerId), filter));
  }

  private async buildEntries(customerId: string): Promise<CustomerActivityEntry[]> {
    const invoices = await this.invoices.list({ searchText: '', status: 'all', customerId });

    const invoiceEntries: CustomerActivityEntry[] = [];
    if (invoices.length > 0) {
      const amountsPaid = await this.paymentTotals.getTotalPaidForInvoices(invoices.map((inv) => inv.id));
      for (const invoice of invoices) {
        const { grandTotal } = sumInvoiceTotals(invoice.items);
        const amountPaid = amountsPaid[invoice.id] ?? 0;
        // Raw status keyword (e.g. `'overdue'`), not a display label — matches
        // `InMemoryCustomerActivityRepository`'s existing convention, since
        // `summarizeActivity()` filters on `entry.status === 'overdue'`
        // literally. `CustomerActivityRow` renders it as-is either way.
        const status = computeInvoiceStatus({ grandTotal, amountPaid, dueDate: invoice.dueDate });
        invoiceEntries.push({
          id: invoice.id,
          type: 'invoice' as const,
          date: invoice.issueDate,
          title: `Invoice ${invoice.invoiceNumber}`,
          amount: grandTotal,
          status,
        });
      }
    }

    const payments = await this.payments.list({
      searchText: '',
      method: 'all',
      customerId,
    });
    const paymentEntries: CustomerActivityEntry[] = payments.map((p) => ({
      id: p.id,
      type: 'payment' as const,
      date: p.paymentDate,
      title: `Payment for ${p.invoiceNumber}`,
      amount: p.amount,
      status: PAYMENT_METHOD_LABELS[p.method],
    }));

    return [...invoiceEntries, ...paymentEntries];
  }
}
