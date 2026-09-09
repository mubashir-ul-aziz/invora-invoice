import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';

/**
 * `Item` is a reusable **catalog definition** — a thing the business sells,
 * with its default price/tax/dimensions. It is never invoice history.
 *
 * When an item is later added to an invoice (Phase 6), `InvoiceItem` will
 * copy a snapshot of these fields onto the invoice line at that moment in
 * time. Renaming or re-pricing an `Item` after the fact must never change
 * what an already-created invoice shows — so this type, its repository, and
 * its table must never grow invoice-linkage columns (an `invoiceId`, a
 * `lastInvoicedAt`, etc.). See `MVP_BUILD_PLAN.md` §6.2.
 */
export interface Item {
  id: string;
  name: string;
  description: string | null;
  /** SKU / item code. Free text, not enforced unique — see Known limitations. */
  sku: string | null;
  /** Unit of sale, e.g. "pcs", "kg", "hr". Free text, not a fixed enum. */
  unit: string | null;
  /** The price used to prefill a new invoice line; always editable per-line afterwards. */
  defaultPrice: number;
  /** Percentage (0–100); null = no default tax for this item. */
  taxRate: number | null;
  weight: number | null;
  /**
   * Unit `weight` is in (kg/g/lb/oz) — only meaningful when
   * `invoiceTypeId === 'weight'`. Optional (not just nullable), like
   * `InvoiceItemSnapshot.weightUnit`, so every call site/fixture that
   * predates this field keeps compiling unchanged; treated the same as
   * `null` ("no unit set") wherever it's read.
   */
  weightUnit?: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  /** Unit `length`/`width`/`height` are in (m/cm/mm/ft/in/yd) — only meaningful for the length/area/volume methods. Optional, same reasoning as `weightUnit`. */
  lengthUnit?: string | null;
  /**
   * Which Pricing Method this item belongs to (General/Quantity/Weight/
   * Length/Area/Volume/Time/Service/Custom — `domain/invoiceType/invoiceTypeRegistry.ts`).
   * Drives which of the physical fields above are relevant to this item —
   * see `domain/item/relevantFields.ts` — and which invoices it can be added
   * to (§15 of the brief: an item can only go on an invoice with the same
   * pricing method).
   */
  invoiceTypeId: InvoiceTypeId;
  createdAt: string;
  updatedAt: string;
}

/** Fields the Create/Edit Item screens collect; id/timestamps are repository-managed. */
export type ItemInput = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>;

export const EMPTY_ITEM_INPUT: ItemInput = {
  name: '',
  description: null,
  sku: null,
  unit: null,
  defaultPrice: 0,
  taxRate: null,
  weight: null,
  weightUnit: null,
  length: null,
  width: null,
  height: null,
  lengthUnit: null,
  invoiceTypeId: 'general',
};

/** Search + filter criteria for the Items List screen. */
export interface ItemFilter {
  /** Matched against name, SKU, and description (case-insensitive substring). */
  searchText: string;
  /** `'all'` (default) means no invoice-type filter applied. */
  invoiceTypeId: InvoiceTypeId | 'all';
}

export const EMPTY_ITEM_FILTER: ItemFilter = {
  searchText: '',
  invoiceTypeId: 'all',
};
