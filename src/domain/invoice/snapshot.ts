import type { InvoiceFieldConfig } from '@/domain/invoiceType/types';
import type { Item } from '@/domain/item/types';

import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceItemInput } from './types';

function has(fieldConfig: InvoiceFieldConfig, key: string): boolean {
  return fieldConfig.fields.some((field) => field.key === key);
}

/**
 * Builds a brand-new invoice line from a catalog `Item` — the moment the
 * **snapshot** happens (see the doc comment on `InvoiceItemSnapshot` in
 * `types.ts`). Everything copied here is a plain value, never a reference
 * back to the item; nothing downstream ever re-reads the `Item` table to
 * redraw this line, so renaming/re-pricing/deleting the catalog item later
 * cannot change it.
 *
 * Only fields present in the invoice's resolved field set are populated —
 * e.g. a "General" invoice (no Weight field) never copies `item.weight` onto
 * the line, even though the catalog item has one.
 */
export function invoiceLineFromItem(item: Item, fieldConfig: InvoiceFieldConfig): InvoiceItemInput {
  return {
    itemId: item.id,
    itemName: item.name,
    description: has(fieldConfig, 'description') ? item.description : null,
    sku: has(fieldConfig, 'sku') ? item.sku : null,
    quantity: has(fieldConfig, 'quantity') ? 1 : null,
    unit: has(fieldConfig, 'unit') ? item.unit : null,
    weight: has(fieldConfig, 'weight') ? item.weight : null,
    length: has(fieldConfig, 'length') ? item.length : null,
    width: has(fieldConfig, 'width') ? item.width : null,
    height: has(fieldConfig, 'height') ? item.height : null,
    unitPrice: item.defaultPrice,
    discountPercent: has(fieldConfig, 'discount') ? 0 : null,
    taxPercent: has(fieldConfig, 'tax') ? item.taxRate : null,
  };
}

/** A manually-typed line with no catalog item behind it — `itemId: null`, everything else blank/zeroed per the invoice's field set. */
export function blankInvoiceLine(fieldConfig: InvoiceFieldConfig): InvoiceItemInput {
  return {
    ...EMPTY_INVOICE_ITEM_INPUT,
    quantity: has(fieldConfig, 'quantity') ? 1 : null,
    discountPercent: has(fieldConfig, 'discount') ? 0 : null,
    taxPercent: null,
  };
}

/**
 * Re-applies the "only fields in the field set are populated" rule to an
 * *already-entered* line — called when the invoice's type changes after
 * lines were added (e.g. switching Dimension → General), so a field that's
 * no longer part of the invoice (Length/Width/Height) can't silently keep a
 * stale value around, invisible on screen but still sitting in the draft.
 */
export function reconcileInvoiceLineWithFieldConfig(
  line: InvoiceItemInput,
  fieldConfig: InvoiceFieldConfig,
): InvoiceItemInput {
  return {
    ...line,
    description: has(fieldConfig, 'description') ? line.description : null,
    sku: has(fieldConfig, 'sku') ? line.sku : null,
    quantity: has(fieldConfig, 'quantity') ? (line.quantity ?? 1) : null,
    unit: has(fieldConfig, 'unit') ? line.unit : null,
    weight: has(fieldConfig, 'weight') ? line.weight : null,
    length: has(fieldConfig, 'length') ? line.length : null,
    width: has(fieldConfig, 'width') ? line.width : null,
    height: has(fieldConfig, 'height') ? line.height : null,
    discountPercent: has(fieldConfig, 'discount') ? (line.discountPercent ?? 0) : null,
    taxPercent: has(fieldConfig, 'tax') ? line.taxPercent : null,
  };
}
