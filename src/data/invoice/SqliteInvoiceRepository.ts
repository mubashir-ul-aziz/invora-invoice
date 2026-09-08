import { asc, eq, inArray } from 'drizzle-orm';

import { calculateLineTotal } from '@/domain/invoice/calculations';
import { invoiceMatchesFilter, sortInvoices } from '@/domain/invoice/filtering';
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

import { getDatabase, getDrizzle } from '../db/client';
import { invoice, invoiceItem } from '../db/schema';
import type { InvoiceRepository } from './InvoiceRepository';

/** The transaction handle `db.transaction()`'s callback receives, extracted from `getDrizzle()`'s own type rather than re-declared (and risking drift). */
type Tx = Parameters<Parameters<ReturnType<typeof getDrizzle>['transaction']>[0]>[0];

function toLineSnapshot(row: typeof invoiceItem.$inferSelect): InvoiceItemSnapshot {
  return {
    id: row.id,
    itemId: row.itemId,
    itemName: row.itemName,
    description: row.description,
    sku: row.sku,
    quantity: row.quantity,
    unit: row.unit,
    weight: row.weight,
    length: row.length,
    width: row.width,
    height: row.height,
    unitPrice: row.unitPrice,
    discountPercent: row.discountPercent,
    taxPercent: row.taxPercent,
    subtotal: row.subtotal,
    discountAmount: row.discountAmount,
    taxAmount: row.taxAmount,
    lineTotal: row.lineTotal,
  };
}

function toInvoice(row: typeof invoice.$inferSelect, lines: InvoiceItemSnapshot[]): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    customerId: row.customerId,
    customerName: row.customerName,
    invoiceTypeId: row.invoiceType as InvoiceTypeId,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    notes: row.notes,
    terms: row.terms,
    items: lines,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Real implementation of `InvoiceRepository` against the `invoice` /
 * `invoice_item` tables (`db/schema.ts`). No Jest coverage — Jest can't
 * drive the native SQLite module without a device, same as every other
 * Sqlite* repository in this codebase; the search/filter semantics it
 * implements are unit-tested once, in plain TypeScript, via
 * `domain/invoice/filtering.ts`, which `InMemoryInvoiceRepository` also runs
 * directly, and the line-total math via `domain/invoice/calculations.ts`,
 * shared by both implementations so the numbers can never diverge.
 */
export class SqliteInvoiceRepository implements InvoiceRepository {
  async list(filter: InvoiceFilter = EMPTY_INVOICE_FILTER): Promise<Invoice[]> {
    await getDatabase();
    const db = getDrizzle();

    const invoiceRows = await db.select().from(invoice);
    if (invoiceRows.length === 0) {
      return [];
    }

    const lineRows = await db
      .select()
      .from(invoiceItem)
      .where(inArray(invoiceItem.invoiceId, invoiceRows.map((row) => row.id)))
      .orderBy(asc(invoiceItem.sortOrder));

    const linesByInvoiceId = groupLinesByInvoiceId(lineRows);
    const invoices = invoiceRows.map((row) => toInvoice(row, linesByInvoiceId[row.id] ?? []));

    // Status depends on payment totals this repository has no knowledge of
    // (see the interface doc comment) — `invoiceStore` re-applies the status
    // half of the filter once it has real amounts paid.
    const matching = invoices.filter((inv) => invoiceMatchesFilter(inv, 0, { ...filter, status: 'all' }));
    return sortInvoices(matching);
  }

  async getById(id: string): Promise<Invoice | null> {
    await getDatabase();
    const db = getDrizzle();

    const rows = await db.select().from(invoice).where(eq(invoice.id, id));
    const row = rows[0];
    if (!row) {
      return null;
    }

    const lineRows = await db
      .select()
      .from(invoiceItem)
      .where(eq(invoiceItem.invoiceId, id))
      .orderBy(asc(invoiceItem.sortOrder));

    return toInvoice(row, lineRows.map(toLineSnapshot));
  }

  /**
   * Header + line rows are written in one `db.transaction()` (same
   * synchronous, `.run()`-based pattern as `SqliteBackupRepository.restoreAll()`
   * — see its doc comment for why the callback must stay sync). Without this,
   * an app kill/crash/storage-full error between the header insert and the
   * line inserts would leave a permanently orphaned invoice with zero items —
   * exactly the "recovery from interrupted writes" failure mode Phase 13
   * audits for. Wrapped, a write either lands whole or not at all.
   */
  async create(invoiceNumber: string, input: InvoiceInput): Promise<Invoice> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const id = generateLocalId('inv_');

    db.transaction((tx) => {
      tx.insert(invoice)
        .values({
          id,
          invoiceNumber,
          customerId: input.customerId,
          customerName: input.customerName,
          invoiceType: input.invoiceTypeId,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          notes: input.notes,
          terms: input.terms,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      insertLineRows(tx, id, input.items);
    });

    const created = await this.getById(id);
    if (!created) {
      throw new Error('Failed to read back the invoice after creating it.');
    }
    return created;
  }

  /**
   * Same atomicity concern as `create()`, sharper here: the line-item
   * replace-wholesale strategy first deletes every existing line, then
   * reinserts the new set. Split across separate statements, an interruption
   * between the delete and the reinsert would silently wipe an existing
   * invoice's items for good. One `db.transaction()` makes that impossible —
   * either the whole update lands, or the invoice is left exactly as it was.
   */
  async update(id: string, input: InvoiceUpdateInput): Promise<Invoice> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();

    db.transaction((tx) => {
      tx.update(invoice)
        .set({
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          notes: input.notes,
          terms: input.terms,
          updatedAt: now,
        })
        .where(eq(invoice.id, id))
        .run();

      // Replace the line-item set wholesale — simpler and less error-prone
      // than diffing for the line counts a small business invoice realistically has.
      tx.delete(invoiceItem).where(eq(invoiceItem.invoiceId, id)).run();
      insertLineRows(tx, id, input.items);
    });

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error(`Invoice not found after update: ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await getDatabase();
    const db = getDrizzle();
    // `invoice_item` rows cascade-delete via the FK's `onDelete: 'cascade'`.
    await db.delete(invoice).where(eq(invoice.id, id));
  }
}

/**
 * Shared by `create()`/`update()`, both of which call this from inside their
 * own `db.transaction()` callback — so this takes the transaction handle
 * (`tx`), not the top-level `db`, and stays a plain sync function using
 * `.run()` throughout (see the `create()` doc comment on why that matters).
 */
function insertLineRows(tx: Tx, invoiceId: string, lines: InvoiceItemInput[]): void {
  if (lines.length === 0) {
    return;
  }
  tx.insert(invoiceItem)
    .values(
      lines.map((line, index) => {
        const calc = calculateLineTotal({
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          taxPercent: line.taxPercent,
        });
        return {
          id: generateLocalId('line_'),
          invoiceId,
          itemId: line.itemId,
          sortOrder: index,
          itemName: line.itemName,
          description: line.description,
          sku: line.sku,
          quantity: line.quantity,
          unit: line.unit,
          weight: line.weight,
          length: line.length,
          width: line.width,
          height: line.height,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          taxPercent: line.taxPercent,
          subtotal: calc.subtotal,
          discountAmount: calc.discountAmount,
          taxAmount: calc.taxAmount,
          lineTotal: calc.lineTotal,
        };
      }),
    )
    .run();
}

function groupLinesByInvoiceId(
  rows: (typeof invoiceItem.$inferSelect)[],
): Record<string, InvoiceItemSnapshot[]> {
  const grouped: Record<string, InvoiceItemSnapshot[]> = {};
  for (const row of rows) {
    (grouped[row.invoiceId] ??= []).push(toLineSnapshot(row));
  }
  return grouped;
}
