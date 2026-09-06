import {
  ALL_FIELD_KEYS,
  ALWAYS_INCLUDED_FIELD_KEYS,
  getFieldDefinition,
  type FieldDefinition,
  type FieldKey,
} from './fieldCatalog';
import { getInvoiceTypeDefinition, type InvoiceTypeId } from './invoiceTypeRegistry';

export type { FieldKey, FieldDefinition, InvoiceTypeId };

/**
 * The default field set a brand-new "Custom" invoice type starts from —
 * item, quantity, unit price and tax, the smallest set that still reads as
 * a real invoice line. The business owner can add/remove anything else from
 * the catalog from there.
 */
export const DEFAULT_CUSTOM_FIELD_KEYS: FieldKey[] = ['itemName', 'quantity', 'unitPrice', 'tax'];

/**
 * What's actually persisted: which invoice type is selected, plus — only
 * meaningful when that type is "custom" — which fields were chosen for it.
 * This is the "proper domain model" the brief asks for: screens never read
 * or write raw strings/columns, only this shape.
 */
export interface InvoiceTypeSelection {
  invoiceTypeId: InvoiceTypeId;
  /** Field keys chosen for the "custom" type, in display order. Ignored (and persisted empty) for fixed types. */
  customFieldKeys: FieldKey[];
  updatedAt: string;
}

export type InvoiceTypeSelectionInput = Omit<InvoiceTypeSelection, 'updatedAt'>;

export const EMPTY_INVOICE_TYPE_SELECTION_INPUT: InvoiceTypeSelectionInput = {
  invoiceTypeId: 'general',
  customFieldKeys: DEFAULT_CUSTOM_FIELD_KEYS,
};

/**
 * The resolved, ready-to-render field list for a selection. This is what
 * invoice-building screens/PDF rendering (later phases) are meant to
 * consume — they call `resolveInvoiceFieldConfig` and map over `fields`,
 * instead of switching on `invoiceTypeId` and hard-coding a field list
 * per case.
 */
export interface InvoiceFieldConfig {
  invoiceTypeId: InvoiceTypeId;
  fields: FieldDefinition[];
}

/**
 * De-dupes, drops unknown keys, guarantees the always-included fields are
 * present, and puts everything back in canonical catalog order — the one
 * place custom field lists get normalized, so a malformed/older persisted
 * value can never produce a broken or duplicated field list on screen.
 */
export function normalizeCustomFieldKeys(keys: FieldKey[]): FieldKey[] {
  const requested = new Set<FieldKey>(keys);
  for (const key of ALWAYS_INCLUDED_FIELD_KEYS) {
    requested.add(key);
  }
  return ALL_FIELD_KEYS.filter((key) => requested.has(key));
}

/** Resolves a persisted selection into the concrete list of fields to render. */
export function resolveInvoiceFieldConfig(
  selection: InvoiceTypeSelectionInput,
): InvoiceFieldConfig {
  const definition = getInvoiceTypeDefinition(selection.invoiceTypeId);
  const keys = definition.fields ?? normalizeCustomFieldKeys(selection.customFieldKeys);
  return {
    invoiceTypeId: selection.invoiceTypeId,
    fields: keys.map(getFieldDefinition),
  };
}
