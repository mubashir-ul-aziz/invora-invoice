import { z } from 'zod';

import { CUSTOM_BUILDER_FIELD_KEYS, type FieldKey } from './fieldCatalog';
import { normalizeCustomFieldKeys } from './types';

/**
 * The Custom Pricing Method builder's form shape: one boolean per toggleable
 * field in the catalog (checked = included on the invoice). Built from
 * `CUSTOM_BUILDER_FIELD_KEYS` — every catalog field except the bare
 * `weightUnit`/`lengthUnit`/`timeUnit` selectors, which only make sense
 * paired with a fixed measurement method, not as a standalone Custom toggle
 * — rather than a hand-written list of keys, so a new catalog entry is
 * picked up automatically.
 *
 * The always-included fields (item name, unit price) are locked "on" in the
 * builder UI, but this schema normalizes them back in regardless — via the
 * same `normalizeCustomFieldKeys` the rest of the domain uses — so a
 * malformed submission can never produce an invoice with no name or price.
 */
const fieldSelectionShape = Object.fromEntries(
  CUSTOM_BUILDER_FIELD_KEYS.map((key) => [key, z.boolean()]),
) as Record<FieldKey, z.ZodBoolean>;

export const customFieldSelectionFormSchema = z
  .object(fieldSelectionShape)
  .transform((values) => normalizeCustomFieldKeys(CUSTOM_BUILDER_FIELD_KEYS.filter((key) => values[key])));

export type CustomFieldSelectionFormValues = z.input<typeof customFieldSelectionFormSchema>;
export type CustomFieldSelectionFormOutput = z.output<typeof customFieldSelectionFormSchema>;
