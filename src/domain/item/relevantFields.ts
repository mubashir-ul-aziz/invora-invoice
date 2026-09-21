import type { FieldKey } from '@/domain/invoiceType/fieldCatalog';
import { getInvoiceTypeDefinition, type InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';

/**
 * The subset of the field catalog that maps to a physical attribute stored
 * directly on `Item` (as opposed to per-invoice-line-only concepts like
 * discount, which don't belong on a catalog definition). Includes every
 * pricing-method-specific unit selector (`unit`/`weightUnit`/`lengthUnit`/
 * `timeUnit`) alongside its measurement — an item's catalog default needs
 * both to mean anything (e.g. a default weight without a unit is ambiguous).
 * `unit` (the generic Billing Unit dropdown) belongs here too: it's only
 * relevant for General/Quantity/Service, never alongside weight/length/time's
 * own unit fields, same as those.
 */
export const ITEM_PHYSICAL_FIELD_KEYS: FieldKey[] = [
  'unit',
  'weight',
  'weightUnit',
  'length',
  'width',
  'height',
  'lengthUnit',
  'timeUnit',
];

/**
 * Which of Item's optional physical fields are relevant to show on the
 * Create/Edit Item form for a given pricing method — so a "General" item
 * doesn't show a Weight field, a "Weight" item doesn't show Length/Width/
 * Height, etc. Reuses `INVOICE_TYPE_REGISTRY` instead of duplicating the
 * field matrix.
 *
 * For `'custom'`, the business's own field selection (`customFieldKeys`)
 * narrows the result further; when that selection isn't available yet (e.g.
 * still loading), all physical fields are shown so nothing a custom invoice
 * might need ends up hidden. (Custom's builder excludes the bare
 * `weightUnit`/`lengthUnit`/`timeUnit` fields — see `CUSTOM_BUILDER_FIELD_KEYS`
 * — so this only matters for weight/length/width/height/`unit` there.)
 */
export function relevantOptionalFieldsForInvoiceType(
  invoiceTypeId: InvoiceTypeId,
  customFieldKeys?: FieldKey[],
): FieldKey[] {
  if (invoiceTypeId === 'custom') {
    if (!customFieldKeys) {
      return ITEM_PHYSICAL_FIELD_KEYS;
    }
    return ITEM_PHYSICAL_FIELD_KEYS.filter((key) => customFieldKeys.includes(key));
  }
  const definition = getInvoiceTypeDefinition(invoiceTypeId);
  const fields = definition.fields ?? [];
  return ITEM_PHYSICAL_FIELD_KEYS.filter((key) => fields.includes(key));
}
