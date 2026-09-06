import { ALL_FIELD_KEYS, getFieldDefinition, type FieldKey } from './fieldCatalog';
import type { CustomFieldSelectionFormValues } from './validation';
import {
  DEFAULT_CUSTOM_FIELD_KEYS,
  normalizeCustomFieldKeys,
  resolveInvoiceFieldConfig,
  type InvoiceTypeSelection,
  type InvoiceTypeSelectionInput,
} from './types';

/** Selection (or nothing, for "never configured") -> the Custom builder's checkbox form defaults. */
export function selectionToCustomFormDefaults(
  selection: InvoiceTypeSelection | InvoiceTypeSelectionInput | null,
): CustomFieldSelectionFormValues {
  const keys = normalizeCustomFieldKeys(
    selection && selection.invoiceTypeId === 'custom' && selection.customFieldKeys.length
      ? selection.customFieldKeys
      : DEFAULT_CUSTOM_FIELD_KEYS,
  );
  const keySet = new Set<FieldKey>(keys);
  return Object.fromEntries(ALL_FIELD_KEYS.map((key) => [key, keySet.has(key)])) as Record<
    FieldKey,
    boolean
  >;
}

/** A human-readable preview of the fields a selection resolves to, e.g. "Item Name, Quantity, Unit Price, Tax". */
export function describeSelectionFields(selection: InvoiceTypeSelectionInput): string {
  const { fields } = resolveInvoiceFieldConfig(selection);
  return fields.map((field) => field.label).join(', ');
}

/** A preview for a fixed invoice type's own field list, without needing a full selection. */
export function describeFixedTypeFields(keys: FieldKey[]): string {
  return keys.map((key) => getFieldDefinition(key).label).join(', ');
}
