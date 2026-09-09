import { getInvoiceTypeDefinition } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { InvoiceFieldConfig } from '@/domain/invoiceType/types';
import type { Item } from '@/domain/item/types';

import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceItemInput } from './types';

function has(fieldConfig: InvoiceFieldConfig, key: string): boolean {
  return fieldConfig.fields.some((field) => field.key === key);
}

/** The unit a brand-new line of this field config's method should start with — `null` for methods with no unit-selector field. */
function defaultUnitFor(fieldConfig: InvoiceFieldConfig, key: 'weightUnit' | 'lengthUnit' | 'timeUnit'): string | null {
  if (!has(fieldConfig, key)) {
    return null;
  }
  return getInvoiceTypeDefinition(fieldConfig.invoiceTypeId).defaultUnit ?? null;
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
 * the line, even though the catalog item has one. Unit fields prefer the
 * item's own saved unit (so a "Flooring" item catalogued in `ft` keeps
 * defaulting to `ft`) and fall back to the method's default unit otherwise.
 */
export function invoiceLineFromItem(item: Item, fieldConfig: InvoiceFieldConfig): InvoiceItemInput {
  return {
    itemId: item.id,
    // Stamped from the invoice's own field config, never the catalog item's
    // own `invoiceTypeId` — the item picker (`ItemListScreen`) already
    // refuses to let an incompatible item reach this point (§15), so the
    // two are always equal here; this just makes the resulting line
    // self-describing for `assertLinesMatchPricingMethod`.
    pricingMethodId: fieldConfig.invoiceTypeId,
    itemName: item.name,
    description: has(fieldConfig, 'description') ? item.description : null,
    sku: has(fieldConfig, 'sku') ? item.sku : null,
    quantity: has(fieldConfig, 'quantity') ? 1 : null,
    unit: has(fieldConfig, 'unit') ? item.unit : null,
    weight: has(fieldConfig, 'weight') ? item.weight : null,
    weightUnit: has(fieldConfig, 'weightUnit') ? (item.weightUnit ?? defaultUnitFor(fieldConfig, 'weightUnit')) : null,
    length: has(fieldConfig, 'length') ? item.length : null,
    width: has(fieldConfig, 'width') ? item.width : null,
    height: has(fieldConfig, 'height') ? item.height : null,
    lengthUnit: has(fieldConfig, 'lengthUnit') ? (item.lengthUnit ?? defaultUnitFor(fieldConfig, 'lengthUnit')) : null,
    timeUnit: has(fieldConfig, 'timeUnit') ? defaultUnitFor(fieldConfig, 'timeUnit') : null,
    unitPrice: item.defaultPrice,
    discountPercent: has(fieldConfig, 'discount') ? 0 : null,
    taxPercent: has(fieldConfig, 'tax') ? item.taxRate : null,
  };
}

/** A manually-typed line with no catalog item behind it — `itemId: null`, everything else blank/zeroed per the invoice's field set. */
export function blankInvoiceLine(fieldConfig: InvoiceFieldConfig): InvoiceItemInput {
  return {
    ...EMPTY_INVOICE_ITEM_INPUT,
    pricingMethodId: fieldConfig.invoiceTypeId,
    quantity: has(fieldConfig, 'quantity') ? 1 : null,
    weightUnit: defaultUnitFor(fieldConfig, 'weightUnit'),
    lengthUnit: defaultUnitFor(fieldConfig, 'lengthUnit'),
    timeUnit: defaultUnitFor(fieldConfig, 'timeUnit'),
    discountPercent: has(fieldConfig, 'discount') ? 0 : null,
    taxPercent: null,
  };
}

/**
 * Re-applies the "only fields in the field set are populated" rule to an
 * *already-entered* line — called when switching between two pricing
 * methods that share the same underlying field shape (e.g. General ↔
 * Quantity ↔ Service, all plain quantity × price). Genuinely incompatible
 * switches (e.g. Area → Weight) are **not** routed through this function —
 * see `CreateInvoiceItemsScreen`'s confirmation flow — since there is no
 * safe way to turn a length × width into a weight; the brief's §19 asks to
 * prevent that rather than guess.
 */
export function reconcileInvoiceLineWithFieldConfig(
  line: InvoiceItemInput,
  fieldConfig: InvoiceFieldConfig,
): InvoiceItemInput {
  return {
    ...line,
    pricingMethodId: fieldConfig.invoiceTypeId,
    description: has(fieldConfig, 'description') ? line.description : null,
    sku: has(fieldConfig, 'sku') ? line.sku : null,
    quantity: has(fieldConfig, 'quantity') ? (line.quantity ?? 1) : null,
    unit: has(fieldConfig, 'unit') ? line.unit : null,
    weight: has(fieldConfig, 'weight') ? line.weight : null,
    weightUnit: has(fieldConfig, 'weightUnit') ? (line.weightUnit ?? defaultUnitFor(fieldConfig, 'weightUnit')) : null,
    length: has(fieldConfig, 'length') ? line.length : null,
    width: has(fieldConfig, 'width') ? line.width : null,
    height: has(fieldConfig, 'height') ? line.height : null,
    lengthUnit: has(fieldConfig, 'lengthUnit') ? (line.lengthUnit ?? defaultUnitFor(fieldConfig, 'lengthUnit')) : null,
    timeUnit: has(fieldConfig, 'timeUnit') ? (line.timeUnit ?? defaultUnitFor(fieldConfig, 'timeUnit')) : null,
    discountPercent: has(fieldConfig, 'discount') ? (line.discountPercent ?? 0) : null,
    taxPercent: has(fieldConfig, 'tax') ? line.taxPercent : null,
  };
}

/**
 * Whether switching from one pricing method to another can safely reuse the
 * existing lines' entered values (`reconcileInvoiceLineWithFieldConfig`)
 * rather than requiring the invoice's lines to be cleared first. Safe only
 * within the "plain quantity × price" family (General/Quantity/Service),
 * which all share the exact same field shape and calculation — every other
 * pair involves a physical measurement that has no meaningful equivalent
 * under the other method (§19: "prefer preventing the change ... unless all
 * existing lines can safely be converted").
 */
export function canSafelyConvertPricingMethod(
  fromId: InvoiceFieldConfig['invoiceTypeId'],
  toId: InvoiceFieldConfig['invoiceTypeId'],
): boolean {
  const QUANTITY_FAMILY = new Set(['general', 'quantity', 'service']);
  return QUANTITY_FAMILY.has(fromId) && QUANTITY_FAMILY.has(toId);
}
