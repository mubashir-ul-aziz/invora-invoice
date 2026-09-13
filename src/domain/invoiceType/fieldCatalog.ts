import { GENERIC_UNITS, LENGTH_UNITS, TIME_UNITS, WEIGHT_UNITS } from './units';

/**
 * The single catalog of every item-line field the app knows how to render.
 * Every pricing method (built-in or custom) is defined as a *list of keys
 * into this catalog* — nothing downstream (screens, forms, PDF rendering)
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
  | 'weightUnit'
  | 'length'
  | 'width'
  | 'height'
  | 'lengthUnit'
  | 'timeUnit'
  | 'unitPrice'
  | 'discount'
  | 'tax';

export type FieldInputKind = 'text' | 'multiline' | 'integer' | 'decimal' | 'select';

export interface FieldDefinition {
  key: FieldKey;
  label: string;
  inputKind: FieldInputKind;
  /**
   * True for the two fields every invoice line needs regardless of pricing
   * method (an item can't be invoiced without a name or a price). The
   * Custom Pricing Method builder shows these as always-selected and
   * non-removable instead of letting them be turned off.
   */
  alwaysIncluded?: boolean;
  /** Only set for `inputKind: 'select'` fields — the fixed dropdown choices. */
  options?: { value: string; label: string }[];
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
  unit: {
    key: 'unit',
    label: 'Unit',
    inputKind: 'select',
    options: GENERIC_UNITS,
  },
  weight: { key: 'weight', label: 'Weight', inputKind: 'decimal' },
  weightUnit: {
    key: 'weightUnit',
    label: 'Weight unit',
    inputKind: 'select',
    options: WEIGHT_UNITS.map((u) => ({ value: u.value, label: u.label })),
  },
  length: { key: 'length', label: 'Length', inputKind: 'decimal' },
  width: { key: 'width', label: 'Width', inputKind: 'decimal' },
  height: { key: 'height', label: 'Height', inputKind: 'decimal' },
  lengthUnit: {
    key: 'lengthUnit',
    label: 'Dimension unit',
    inputKind: 'select',
    options: LENGTH_UNITS.map((u) => ({ value: u.value, label: u.label })),
  },
  timeUnit: {
    key: 'timeUnit',
    label: 'Time unit',
    inputKind: 'select',
    options: TIME_UNITS.map((u) => ({ value: u.value, label: u.label })),
  },
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

/**
 * The subset of `ALL_FIELD_KEYS` the Custom Pricing Method builder lets a
 * business owner toggle on/off. Unit-selector fields (`weightUnit`,
 * `lengthUnit`, `timeUnit`) are deliberately excluded — they only make sense
 * paired with their own measurement field, which Custom doesn't offer as a
 * togglable pair (Custom stays a simple General-shaped line by design; see
 * §3 CUSTOM in the brief), so offering them standalone would just confuse
 * the checklist.
 */
export const CUSTOM_BUILDER_FIELD_KEYS: FieldKey[] = ALL_FIELD_KEYS.filter(
  (key) => !['weightUnit', 'lengthUnit', 'timeUnit'].includes(key),
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
