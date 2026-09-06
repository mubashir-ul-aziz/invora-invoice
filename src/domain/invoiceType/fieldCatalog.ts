/**
 * The single catalog of every item-line field the app knows how to render.
 * Every invoice type (built-in or custom) is defined as a *list of keys into
 * this catalog* — nothing downstream (screens, forms, future PDF rendering)
 * hard-codes a field's label or input kind. Adding a brand-new field later
 * means adding one entry here; every screen that walks `FIELD_DEFINITIONS`
 * or a resolved `InvoiceFieldConfig` (see `types.ts`) picks it up for free.
 */

export type FieldKey =
  | 'itemName'
  | 'description'
  | 'sku'
  | 'quantity'
  | 'unit'
  | 'weight'
  | 'length'
  | 'width'
  | 'height'
  | 'unitPrice'
  | 'discount'
  | 'tax';

export type FieldInputKind = 'text' | 'multiline' | 'integer' | 'decimal';

export interface FieldDefinition {
  key: FieldKey;
  label: string;
  inputKind: FieldInputKind;
  /**
   * True for the two fields every invoice line needs regardless of type
   * (an item can't be invoiced without a name or a price). The Custom
   * Invoice Type builder shows these as always-selected and non-removable
   * instead of letting them be turned off.
   */
  alwaysIncluded?: boolean;
}

/**
 * Order here is the canonical display order used everywhere a field list is
 * rendered (the Custom builder checklist, a resolved field-config preview,
 * etc.) — one place decides ordering, not each screen separately.
 */
export const FIELD_DEFINITIONS: Record<FieldKey, FieldDefinition> = {
  itemName: { key: 'itemName', label: 'Item Name', inputKind: 'text', alwaysIncluded: true },
  description: { key: 'description', label: 'Description', inputKind: 'multiline' },
  sku: { key: 'sku', label: 'SKU', inputKind: 'text' },
  quantity: { key: 'quantity', label: 'Quantity', inputKind: 'decimal' },
  unit: { key: 'unit', label: 'Unit', inputKind: 'text' },
  weight: { key: 'weight', label: 'Weight', inputKind: 'decimal' },
  length: { key: 'length', label: 'Length', inputKind: 'decimal' },
  width: { key: 'width', label: 'Width', inputKind: 'decimal' },
  height: { key: 'height', label: 'Height', inputKind: 'decimal' },
  unitPrice: { key: 'unitPrice', label: 'Unit Price', inputKind: 'decimal', alwaysIncluded: true },
  discount: { key: 'discount', label: 'Discount', inputKind: 'decimal' },
  tax: { key: 'tax', label: 'Tax', inputKind: 'decimal' },
};

/** Every known field key, in canonical display order. */
export const ALL_FIELD_KEYS: FieldKey[] = Object.keys(FIELD_DEFINITIONS) as FieldKey[];

/** The fields that can never be turned off in the Custom builder. */
export const ALWAYS_INCLUDED_FIELD_KEYS: FieldKey[] = ALL_FIELD_KEYS.filter(
  (key) => FIELD_DEFINITIONS[key].alwaysIncluded,
);

export function getFieldDefinition(key: FieldKey): FieldDefinition {
  const definition = FIELD_DEFINITIONS[key];
  if (!definition) {
    throw new Error(`Unknown invoice field key: ${key}`);
  }
  return definition;
}

export function isFieldKey(value: string): value is FieldKey {
  return Object.prototype.hasOwnProperty.call(FIELD_DEFINITIONS, value);
}
