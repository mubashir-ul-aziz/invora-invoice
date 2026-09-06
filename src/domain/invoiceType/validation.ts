import { z } from 'zod';

import { ALL_FIELD_KEYS, type FieldKey } from './fieldCatalog';
import { normalizeCustomFieldKeys } from './types';

/**
 * The Custom Invoice Type builder's form shape: one boolean per field in the
 * catalog (checked = included on the invoice). Built from `ALL_FIELD_KEYS`
 * rather than a hand-written list of keys, so a new catalog entry is picked
 * up automatically.
 *
 * The always-included fields (item name, unit price) are locked "on" in the
 * builder UI, but this schema normalizes them back in regardless — via the
 * same `normalizeCustomFieldKeys` the rest of the domain uses — so a
 * malformed submission can never produce an invoice with no name or price.
 */
const fieldSelectionShape = Object.fromEntries(
  ALL_FIELD_KEYS.map((key) => [key, z.boolean()]),
) as Record<FieldKey, z.ZodBoolean>;

export const customFieldSelectionFormSchema = z
  .object(fieldSelectionShape)
  .transform((values) => normalizeCustomFieldKeys(ALL_FIELD_KEYS.filter((key) => values[key])));

export type CustomFieldSelectionFormValues = z.input<typeof customFieldSelectionFormSchema>;
export type CustomFieldSelectionFormOutput = z.output<typeof customFieldSelectionFormSchema>;
