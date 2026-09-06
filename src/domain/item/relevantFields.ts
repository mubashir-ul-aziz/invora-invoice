import type { FieldKey } from '@/domain/invoiceType/fieldCatalog';
import { getInvoiceTypeDefinition, type InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';

/**
 * The subset of the Phase 3 field catalog that maps to a physical attribute
 * stored directly on `Item` (as opposed to per-invoice-line-only concepts
 * like quantity/discount, which don't belong on a catalog definition).
 */
export const ITEM_PHYSICAL_FIELD_KEYS: FieldKey[] = ['weight', 'length', 'width', 'height'];

/**
 * Which of Item's optional physical fields (weight/length/width/height) are
 * relevant to show on the Create/Edit Item form for a given invoice type —
 * so a "General" item doesn't show a Weight field, a "Weight" item doesn't
 * show Length/Width/Height, etc. Reuses Phase 3's `INVOICE_TYPE_REGISTRY`
 * instead of duplicating the field matrix.
 *
 * For `'custom'`, the business's own Phase 3 field selection
 * (`customFieldKeys`) narrows the result further; when that selection isn't
 * available yet (e.g. still loading), all four fields are shown so nothing
 * a custom invoice might need ends up hidden.
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
