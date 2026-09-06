import type { FieldKey } from './fieldCatalog';

/**
 * The set of invoice types the app ships with. `general` and `quantity` are
 * both fixed presets defined by the brief; they happen to share the same
 * field list today, but each is its own registry entry so one can change
 * independently of the other later without touching this type union.
 */
export type InvoiceTypeId = 'general' | 'quantity' | 'weight' | 'dimension' | 'custom';

export interface InvoiceTypeDefinition {
  id: InvoiceTypeId;
  label: string;
  description: string;
  /**
   * The field list this type puts on an invoice line, in display order.
   * `null` means "configurable" — the business owner picks the fields
   * themselves (today, only `custom`) and the chosen list is persisted
   * separately (see `domain/invoiceType/types.ts`), not hard-coded here.
   */
  fields: FieldKey[] | null;
}

/**
 * The whole invoice-type catalog, in one place. Adding a new invoice type
 * later (fixed or configurable) means adding one entry here — no screen,
 * store, or repository needs to change to pick it up, since everything
 * downstream (`InvoiceTypeSelectionScreen`, `resolveInvoiceFieldConfig`)
 * walks this list instead of switching on hard-coded ids.
 */
export const INVOICE_TYPE_REGISTRY: InvoiceTypeDefinition[] = [
  {
    id: 'general',
    label: 'General',
    description: 'A general-purpose item sold by quantity and unit.',
    fields: ['itemName', 'quantity', 'unit', 'unitPrice', 'discount', 'tax'],
  },
  {
    id: 'quantity',
    label: 'Quantity',
    description: 'An item sold by quantity and unit.',
    fields: ['itemName', 'quantity', 'unit', 'unitPrice', 'discount', 'tax'],
  },
  {
    id: 'weight',
    label: 'Weight',
    description: 'An item sold by weight instead of a fixed unit.',
    fields: ['itemName', 'quantity', 'weight', 'unitPrice', 'discount', 'tax'],
  },
  {
    id: 'dimension',
    label: 'Dimension',
    description: 'An item sized by length, width and height.',
    fields: ['itemName', 'quantity', 'length', 'width', 'height', 'unitPrice', 'discount', 'tax'],
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Choose exactly which fields appear on each line item.',
    fields: null,
  },
];

export const INVOICE_TYPE_IDS: InvoiceTypeId[] = INVOICE_TYPE_REGISTRY.map((def) => def.id);

export function getInvoiceTypeDefinition(id: InvoiceTypeId): InvoiceTypeDefinition {
  const definition = INVOICE_TYPE_REGISTRY.find((def) => def.id === id);
  if (!definition) {
    throw new Error(`Unknown invoice type id: ${id}`);
  }
  return definition;
}

export function isInvoiceTypeId(value: string): value is InvoiceTypeId {
  return INVOICE_TYPE_IDS.includes(value as InvoiceTypeId);
}
