import type { FieldKey } from '@/domain/invoiceType/fieldCatalog';
import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';

/**
 * A **frozen historical record** of one invoice line, copied from an `Item`
 * (or typed manually) at the moment it was added to the invoice — see the
 * "IMPORTANT SNAPSHOT RULE" in `MVP_BUILD_PLAN.md` §6.2. `itemId` is kept
 * only so the UI *could* offer "view current catalog item"; nothing here is
 * ever re-read from the `Item` table to redraw an existing invoice, and
 * renaming/re-pricing/deleting that catalog item must never change this row.
 *
 * `subtotal`/`discountAmount`/`taxAmount`/`lineTotal` are computed exactly
 * once, via `domain/invoice/calculations.ts`'s `calculateLineTotal`, at the
 * moment this line is saved — and stored, not recomputed on every read. That
 * way a future change to the calculation formula can never silently rewrite
 * the numbers on an invoice that already exists.
 */
export interface InvoiceItemSnapshot {
  id: string;
  /** The catalog item this was copied from, or null for a manually-typed line. Never used to look up "current" data. */
  itemId: string | null;
  itemName: string;
  description: string | null;
  sku: string | null;
  /** Null when "Quantity" isn't part of the invoice's selected field set. */
  quantity: number | null;
  unit: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  unitPrice: number;
  /** Percentage (0–100); null = no discount on this line, or the field isn't in use. */
  discountPercent: number | null;
  /** Percentage (0–100); null = no tax on this line, or the field isn't in use. */
  taxPercent: number | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

/** What the line-item editor collects; the four calculated fields are filled in at save time. */
export type InvoiceItemInput = Omit<
  InvoiceItemSnapshot,
  'id' | 'subtotal' | 'discountAmount' | 'taxAmount' | 'lineTotal'
>;

export const EMPTY_INVOICE_ITEM_INPUT: InvoiceItemInput = {
  itemId: null,
  itemName: '',
  description: null,
  sku: null,
  quantity: 1,
  unit: null,
  weight: null,
  length: null,
  width: null,
  height: null,
  unitPrice: 0,
  discountPercent: null,
  taxPercent: null,
};

/**
 * `Invoice` itself has **no stored status/balance field** — same rule as
 * `Customer` (`MVP_BUILD_PLAN.md` §6.3). Paid/partial/unpaid/overdue is
 * always computed from the invoice's own total, its due date, and however
 * much has been paid against it (see `domain/invoice/status.ts`); the amount
 * paid comes from `data/paymentTotals/` (honest zero until Phase 7 builds
 * real `Payment` records) — never a mutable column on this table.
 *
 * `customerName` is a light, additive snapshot (not strictly required by the
 * brief, which only mandates snapshotting *items*) so Invoice List/Detail
 * can render the "bill to" name without a join, and so it keeps its
 * historical name if the customer contact is later renamed — the same
 * reasoning as the item snapshot rule, applied narrowly to the one customer
 * field that's actually displayed inline.
 */
export interface Invoice {
  id: string;
  /** Formatted once at creation from the business's prefix + next number (see `numbering.ts`) and never reassigned. */
  invoiceNumber: string;
  customerId: string;
  /** Snapshot of the customer's name at invoice-creation time. */
  customerName: string;
  /**
   * Which field set this invoice's line items follow (General/Quantity/
   * Weight/Dimension/Custom — the Phase 3 registry). Chosen once when the
   * invoice is created and fixed afterwards, since changing it could orphan
   * already-entered line fields.
   */
  invoiceTypeId: InvoiceTypeId;
  /** ISO calendar date, `YYYY-MM-DD`. */
  issueDate: string;
  /** ISO calendar date, `YYYY-MM-DD`, or null = no due date set. */
  dueDate: string | null;
  notes: string | null;
  terms: string | null;
  items: InvoiceItemSnapshot[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Fields collected across the Create Invoice flow (Customer → Items →
 * Review). `invoiceNumber` is deliberately absent — it's reserved by
 * `BusinessRepository.reserveNextInvoiceNumber()` and supplied by the
 * `InvoiceRepository` implementation, never typed by the user, so a
 * duplicate/blank number can never be submitted from a screen.
 */
export interface InvoiceInput {
  customerId: string;
  customerName: string;
  invoiceTypeId: InvoiceTypeId;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  terms: string | null;
  items: InvoiceItemInput[];
}

/**
 * What Edit Invoice is allowed to change: dates, notes, terms, and items.
 * The customer and invoice type are fixed at creation — see the doc comments
 * on `Invoice.customerId`/`invoiceTypeId` above — so this intentionally
 * excludes them rather than accepting-and-ignoring them.
 */
export type InvoiceUpdateInput = Pick<InvoiceInput, 'issueDate' | 'dueDate' | 'notes' | 'terms' | 'items'>;

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

/** Search + filter criteria for the Invoice List screen. */
export interface InvoiceFilter {
  /** Matched against invoice number and customer name (case-insensitive substring). */
  searchText: string;
  /** `'all'` (default) means no status filter applied. */
  status: InvoiceStatus | 'all';
  /** When set, restricts the list to one customer's invoices (used by Customer History). */
  customerId?: string;
}

export const EMPTY_INVOICE_FILTER: InvoiceFilter = { searchText: '', status: 'all' };

/** Strips a frozen snapshot's calculated fields back down to editable input — used when Edit/Duplicate Invoice loads an existing line back into the draft. */
export function invoiceItemInputFromSnapshot(snapshot: InvoiceItemSnapshot): InvoiceItemInput {
  const { id: _id, subtotal: _subtotal, discountAmount: _discountAmount, taxAmount: _taxAmount, lineTotal: _lineTotal, ...input } = snapshot;
  return input;
}

export type { FieldKey };
