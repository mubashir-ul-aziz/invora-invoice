import { calculateLineTotal } from '@/domain/invoice/calculations';
import { invoiceMatchesFilter, sortInvoices } from '@/domain/invoice/filtering';
import { assertLinesMatchPricingMethod } from '@/domain/invoice/integrity';
import {
  EMPTY_INVOICE_FILTER,
  type Invoice,
  type InvoiceFilter,
  type InvoiceInput,
  type InvoiceItemInput,
  type InvoiceItemSnapshot,
  type InvoiceUpdateInput,
} from '@/domain/invoice/types';
import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import { generateLocalId } from '@/lib/id';

import type { InvoiceRepository } from './InvoiceRepository';

/**
 * Freezes each line's calculated numbers exactly once — shared by `create`
 * and `update`. `pricingMethodId` comes from the invoice itself (never from
 * the line) — see the "one invoice, one pricing method" rule — and is
 * asserted against every line via `assertLinesMatchPricingMethod` before any
 * math runs, the in-memory repository's equivalent of the SQLite
 * repository's same guard.
 */
function buildLineSnapshots(lines: InvoiceItemInput[], pricingMethodId: InvoiceTypeId): InvoiceItemSnapshot[] {
  assertLinesMatchPricingMethod(pricingMethodId, lines);
  return lines.map((line) => {
    const calc = calculateLineTotal(
      {
        quantity: line.quantity,
        weight: line.weight,
        length: line.length,
        width: line.width,
        height: line.height,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent,
        taxPercent: line.taxPercent,
      },
      pricingMethodId,
    );
    return {
      id: generateLocalId('line_'),
      itemId: line.itemId,
      itemName: line.itemName,
      description: line.description,
      sku: line.sku,
      quantity: line.quantity,
      unit: line.unit,
      weight: line.weight,
      weightUnit: line.weightUnit,
      length: line.length,
      width: line.width,
      height: line.height,
      lengthUnit: line.lengthUnit,
      timeUnit: line.timeUnit,
      unitPrice: line.unitPrice,
      discountPercent: line.discountPercent,
      taxPercent: line.taxPercent,
      pricingMethodId,
      subtotal: calc.subtotal,
      discountAmount: calc.discountAmount,
      taxAmount: calc.taxAmount,
      lineTotal: calc.lineTotal,
    };
  });
}

/**
 * Frontend-first mock repository — no database, no I/O. Used to build and
 * unit-test the Invoices UI/state layer before the SQLite-backed repository
 * exists, and kept afterwards for fast Jest tests (same role as
 * `InMemoryItemRepository`/`InMemoryCustomerRepository`).
 */
export class InMemoryInvoiceRepository implements InvoiceRepository {
  private invoices: Invoice[];

  constructor(seed: Invoice[] = []) {
    this.invoices = [...seed];
  }

  async list(filter: InvoiceFilter = EMPTY_INVOICE_FILTER): Promise<Invoice[]> {
    // Status depends on payment totals this repository has no knowledge of
    // (see the interface doc comment) — `invoiceStore` re-applies the status
    // half of the filter once it has real amounts paid from
    // `PaymentTotalsRepository`. Search text and customerId are honored here.
    const matching = this.invoices.filter((invoice) =>
      invoiceMatchesFilter(invoice, 0, { ...filter, status: 'all' }),
    );
    return sortInvoices(matching);
  }

  async getById(id: string): Promise<Invoice | null> {
    return this.invoices.find((invoice) => invoice.id === id) ?? null;
  }

  async create(invoiceNumber: string, input: InvoiceInput): Promise<Invoice> {
    const now = new Date().toISOString();
    const invoice: Invoice = {
      id: generateLocalId('inv_'),
      invoiceNumber,
      customerId: input.customerId,
      customerName: input.customerName,
      invoiceTypeId: input.invoiceTypeId,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      notes: input.notes,
      terms: input.terms,
      items: buildLineSnapshots(input.items, input.invoiceTypeId),
      createdAt: now,
      updatedAt: now,
    };
    this.invoices.push(invoice);
    return invoice;
  }

  async update(id: string, input: InvoiceUpdateInput): Promise<Invoice> {
    const index = this.invoices.findIndex((invoice) => invoice.id === id);
    if (index === -1) {
      throw new Error(`Invoice not found: ${id}`);
    }
    const updated: Invoice = {
      ...this.invoices[index],
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      notes: input.notes,
      terms: input.terms,
      items: buildLineSnapshots(input.items, this.invoices[index].invoiceTypeId),
      updatedAt: new Date().toISOString(),
    };
    this.invoices[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.invoices = this.invoices.filter((invoice) => invoice.id !== id);
  }
}
