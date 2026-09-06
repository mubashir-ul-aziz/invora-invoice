import type { InvoiceRepository } from '@/data/invoice/InvoiceRepository';
import type { PaymentTotalsRepository } from '@/data/paymentTotals/PaymentTotalsRepository';
import { filterActivity, sortActivityChronological, summarizeActivity } from '@/domain/customer/activity';
import type { CustomerActivityEntry, CustomerActivityFilter, CustomerBalanceSummary } from '@/domain/customer/types';
import { sumInvoiceTotals } from '@/domain/invoice/calculations';
import { computeInvoiceStatus } from '@/domain/invoice/status';

import type { CustomerActivityRepository } from './CustomerActivityRepository';

/**
 * The real implementation Phase 5 predicted: reads this customer's actual
 * invoices (Phase 6) and reduces them with the exact same
 * `summarizeActivity()` every mock/testing implementation already shares —
 * see the doc comment on `CustomerActivityRepository`. No `Payment` (Phase 7)
 * rows exist yet, so entries are invoice-only; each invoice's amount paid
 * comes from `PaymentTotalsRepository` (zero today via
 * `ZeroPaymentTotalsRepository`, real once Phase 7 lands) — this class won't
 * need to change when that happens, only the `PaymentTotalsRepository`
 * implementation wired in at the composition root will.
 */
export class InvoiceBackedCustomerActivityRepository implements CustomerActivityRepository {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly paymentTotals: PaymentTotalsRepository,
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
    if (invoices.length === 0) {
      return [];
    }

    const amountsPaid = await this.paymentTotals.getTotalPaidForInvoices(invoices.map((inv) => inv.id));

    return invoices.map((invoice) => {
      const { grandTotal } = sumInvoiceTotals(invoice.items);
      const amountPaid = amountsPaid[invoice.id] ?? 0;
      // Raw status keyword (e.g. `'overdue'`), not a display label — matches
      // `InMemoryCustomerActivityRepository`'s existing convention, since
      // `summarizeActivity()` filters on `entry.status === 'overdue'`
      // literally. `CustomerActivityRow` renders it as-is either way.
      const status = computeInvoiceStatus({ grandTotal, amountPaid, dueDate: invoice.dueDate });
      return {
        id: invoice.id,
        type: 'invoice' as const,
        date: invoice.issueDate,
        title: `Invoice ${invoice.invoiceNumber}`,
        amount: grandTotal,
        status,
      };
    });
  }
}
