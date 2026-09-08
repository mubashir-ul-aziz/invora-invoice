import { eq, sql } from 'drizzle-orm';

import type { DashboardInvoiceEntry } from '@/domain/dashboard/types';

import { getDatabase, getDrizzle } from '../db/client';
import { invoice, invoiceItem, payment } from '../db/schema';
import type { DashboardRepository } from './DashboardRepository';

/**
 * Real implementation of `DashboardRepository`, and the "optimize queries so
 * the dashboard remains fast with many invoices" half of the brief.
 *
 * The dashboard's five numbers need a grand total and an amount-paid for
 * *every* invoice — but never the underlying line-item or payment rows
 * themselves. `InvoiceRepository.list()` (used by Invoice List) isn't reused
 * here on purpose: it loads every `invoice` row *and* every `invoice_item`
 * row into JS just to sum them (see its own doc comment on that tradeoff).
 * This repository instead sums where it's cheapest — inside SQLite — via two
 * grouped aggregate queries, each backed by an existing index
 * (`invoice_item_invoice_idx`, `payment_invoice_idx`):
 *
 *   SELECT invoice.*, SUM(invoice_item.line_total) FROM invoice
 *     LEFT JOIN invoice_item ... GROUP BY invoice.id
 *   SELECT payment.invoice_id, SUM(payment.amount) FROM payment GROUP BY payment.invoice_id
 *
 * A business with thousands of invoices and tens of thousands of line
 * items/payments still only round-trips one row per invoice across the
 * JS/SQLite bridge, not one row per line item or payment.
 *
 * The two queries are kept deliberately separate rather than one query
 * joining both `invoice_item` and `payment`: joining both onto `invoice` in a
 * single query would fan out (an invoice with 3 line items and 2 payments
 * produces 6 joined rows) and silently overcount both sums.
 *
 * No Jest coverage — Jest can't drive the native SQLite module without a
 * device, same as every other `Sqlite*` repository in this codebase; the
 * arithmetic it feeds into is unit-tested once, in plain TypeScript, via
 * `domain/dashboard/calculations.ts`, which `InMemoryDashboardRepository`
 * also feeds directly.
 */
export class SqliteDashboardRepository implements DashboardRepository {
  async getInvoiceEntries(): Promise<DashboardInvoiceEntry[]> {
    await getDatabase();
    const db = getDrizzle();

    const invoiceTotals = await db
      .select({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt,
        grandTotal: sql<number>`COALESCE(SUM(${invoiceItem.lineTotal}), 0)`,
      })
      .from(invoice)
      .leftJoin(invoiceItem, eq(invoiceItem.invoiceId, invoice.id))
      .groupBy(invoice.id);

    if (invoiceTotals.length === 0) {
      return [];
    }

    const paidTotals = await db
      .select({
        invoiceId: payment.invoiceId,
        amountPaid: sql<number>`COALESCE(SUM(${payment.amount}), 0)`,
      })
      .from(payment)
      .groupBy(payment.invoiceId);

    const paidByInvoiceId = new Map(paidTotals.map((row) => [row.invoiceId, Number(row.amountPaid)]));

    return invoiceTotals.map((row) => ({
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoiceNumber,
      customerName: row.customerName,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      createdAt: new Date(row.createdAt).toISOString(),
      grandTotal: Number(row.grandTotal),
      amountPaid: paidByInvoiceId.get(row.invoiceId) ?? 0,
    }));
  }
}
