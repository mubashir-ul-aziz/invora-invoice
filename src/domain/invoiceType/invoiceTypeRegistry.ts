import type { FieldKey } from './fieldCatalog';
import type { MeasurementKind } from './units';
import { DEFAULT_LENGTH_UNIT, DEFAULT_TIME_UNIT, DEFAULT_WEIGHT_UNIT } from './units';

/**
 * The **Pricing Method** — the one thing selected per invoice (§1/§4 of the
 * brief: "an invoice can have unlimited items, but all of them share the
 * invoice's pricing method"). The identifier and this module's filename
 * (`invoiceType*`) predate that renaming; they're kept as-is across the
 * codebase to avoid an app-wide mechanical rename with no device available
 * to verify at runtime (see `IMPLEMENTATION_STATUS.md`/the refactor report).
 * Every user-facing label reads "Pricing Method", not "Invoice Type" —
 * that's the part of the naming that actually reaches a business owner.
 *
 * `dimension` (a single catch-all for length/width/height) is gone — it
 * conflated three different calculations (a single length, an area, a
 * volume) behind one ambiguous field list with no distinct formula. It's
 * replaced by three explicit methods: `length`, `area`, `volume`.
 */
export type InvoiceTypeId =
  | 'general'
  | 'quantity'
  | 'weight'
  | 'length'
  | 'area'
  | 'volume'
  | 'time'
  | 'service'
  | 'custom';

/**
 * How a line's billable quantity is derived from its raw inputs — the
 * dispatch key `domain/invoice/calculations.ts` and
 * `domain/invoiceType/calculators.ts` switch on. Kept separate from
 * `InvoiceTypeId` itself (rather than switching on the id directly) so a
 * future pricing method that happens to calculate the same way as an
 * existing one (e.g. a future `distance` method billing exactly like
 * `length`) can reuse a calculation kind instead of duplicating it.
 */
export type CalculationKind = 'quantityTimesPrice' | 'weight' | 'length' | 'area' | 'volume' | 'time';

export interface InvoiceTypeDefinition {
  id: InvoiceTypeId;
  label: string;
  description: string;
  /**
   * The field list this method puts on an invoice line, in display order.
   * `null` means "configurable" — the business owner picks the fields
   * themselves (today, only `custom`) and the chosen list is persisted
   * separately (see `domain/invoiceType/types.ts`), not hard-coded here.
   */
  fields: FieldKey[] | null;
  calculationKind: CalculationKind;
  /** Which measurement unit family this method's fields use, if any (drives which unit dropdown a `weightUnit`/`lengthUnit`/`timeUnit` field renders). */
  measurementKind?: MeasurementKind;
  /** The unit a brand-new line/item of this method starts with. */
  defaultUnit?: string;
  /**
   * Per-method wording for a field whose generic catalog label
   * (`fieldCatalog.ts`) doesn't fit this method — e.g. TIME's `quantity`
   * field reads "Duration", not "Quantity". Resolved via `getFieldLabel`
   * (`types.ts`) instead of every screen special-casing method ids.
   */
  fieldLabelOverrides?: Partial<Record<FieldKey, string>>;
  /** One line shown next to the calculation preview, e.g. "5m × 4m × price/m²" — purely descriptive. */
  formulaHint: string;
}

/**
 * The whole pricing-method catalog, in one place. Adding a new method later
 * (fixed or configurable) means adding one entry here — no screen, store, or
 * repository needs to change to pick it up, since everything downstream
 * (`InvoiceTypeSelectionScreen`, `resolveInvoiceFieldConfig`,
 * `calculateLineTotal`) walks this list/dispatches on `calculationKind`
 * instead of switching on hard-coded ids. A future `distance`/`daily`/
 * `weekly`/`percentage` method is exactly this: one new entry plus (if its
 * math is genuinely new) one new `CalculationKind` handled in
 * `domain/invoiceType/calculators.ts` — never a new screen.
 */
export const INVOICE_TYPE_REGISTRY: InvoiceTypeDefinition[] = [
  {
    id: 'general',
    label: 'General',
    description: 'A general-purpose product billed by quantity and unit price.',
    fields: ['itemName', 'description', 'sku', 'quantity', 'unit', 'unitPrice', 'discount', 'tax'],
    calculationKind: 'quantityTimesPrice',
    formulaHint: 'quantity × unit price',
  },
  {
    id: 'quantity',
    label: 'Quantity',
    description: 'An item sold by quantity and unit.',
    fields: ['itemName', 'description', 'sku', 'quantity', 'unit', 'unitPrice', 'discount', 'tax'],
    calculationKind: 'quantityTimesPrice',
    formulaHint: 'quantity × unit price',
  },
  {
    id: 'weight',
    label: 'Weight',
    description: 'An item sold by weight — price is per weight unit.',
    fields: ['itemName', 'description', 'sku', 'weight', 'weightUnit', 'unitPrice', 'discount', 'tax'],
    calculationKind: 'weight',
    measurementKind: 'weight',
    defaultUnit: DEFAULT_WEIGHT_UNIT,
    fieldLabelOverrides: { unitPrice: 'Price per weight unit' },
    formulaHint: 'weight × price per weight unit',
  },
  {
    id: 'length',
    label: 'Length',
    description: 'An item sold by length — price is per length unit.',
    fields: ['itemName', 'description', 'sku', 'length', 'lengthUnit', 'unitPrice', 'discount', 'tax'],
    calculationKind: 'length',
    measurementKind: 'length',
    defaultUnit: DEFAULT_LENGTH_UNIT,
    fieldLabelOverrides: { unitPrice: 'Price per length unit' },
    formulaHint: 'length × price per length unit',
  },
  {
    id: 'area',
    label: 'Area',
    description: 'An item sold by area — length × width, priced per area unit.',
    fields: ['itemName', 'description', 'sku', 'length', 'width', 'lengthUnit', 'unitPrice', 'discount', 'tax'],
    calculationKind: 'area',
    measurementKind: 'length',
    defaultUnit: DEFAULT_LENGTH_UNIT,
    fieldLabelOverrides: { unitPrice: 'Price per area unit' },
    formulaHint: 'length × width × price per area unit',
  },
  {
    id: 'volume',
    label: 'Volume',
    description: 'An item sold by volume — length × width × height, priced per volume unit.',
    fields: [
      'itemName',
      'description',
      'sku',
      'length',
      'width',
      'height',
      'lengthUnit',
      'unitPrice',
      'discount',
      'tax',
    ],
    calculationKind: 'volume',
    measurementKind: 'length',
    defaultUnit: DEFAULT_LENGTH_UNIT,
    fieldLabelOverrides: { unitPrice: 'Price per volume unit' },
    formulaHint: 'length × width × height × price per volume unit',
  },
  {
    id: 'time',
    label: 'Time',
    description: 'A service billed by duration — minutes, hours or days.',
    fields: ['itemName', 'description', 'quantity', 'timeUnit', 'unitPrice', 'discount', 'tax'],
    calculationKind: 'time',
    measurementKind: 'time',
    defaultUnit: DEFAULT_TIME_UNIT,
    fieldLabelOverrides: { quantity: 'Duration', unitPrice: 'Rate per time unit' },
    formulaHint: 'duration × rate per time unit',
  },
  {
    id: 'service',
    label: 'Service',
    description: 'A fixed-price service.',
    fields: ['itemName', 'description', 'sku', 'quantity', 'unit', 'unitPrice', 'discount', 'tax'],
    calculationKind: 'quantityTimesPrice',
    fieldLabelOverrides: { itemName: 'Service name', unitPrice: 'Service price' },
    formulaHint: 'quantity × service price',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Choose exactly which fields appear on each line item.',
    fields: null,
    calculationKind: 'quantityTimesPrice',
    formulaHint: 'quantity × unit price',
  },
];

export const INVOICE_TYPE_IDS: InvoiceTypeId[] = INVOICE_TYPE_REGISTRY.map((def) => def.id);

/** `{ value, label }` options for every Pricing Method dropdown in the app — one list, so the choices can never drift between screens. */
export const PRICING_METHOD_OPTIONS: { value: InvoiceTypeId; label: string }[] = INVOICE_TYPE_REGISTRY.map(
  (def) => ({ value: def.id, label: def.label }),
);

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

/**
 * Normalizes a raw, persisted pricing-method string into a currently-valid
 * `InvoiceTypeId` — the one place a pre-this-refactor value read back from
 * the database is reconciled, same pattern as `SqliteBusinessRepository`'s
 * `'minimal'` → `'compact'` template normalization. The old catch-all
 * `'dimension'` method (length+width+height, no distinct formula) maps to
 * `'volume'`, the closest of its three replacements (`length`/`area`/
 * `volume`) — every `Sqlite*Repository` read path calls this instead of a
 * raw `as InvoiceTypeId` cast, so a device that already has `'dimension'`
 * rows on disk from before this change keeps working instead of throwing
 * the moment `getInvoiceTypeDefinition` can't find a matching entry.
 */
export function normalizeLegacyInvoiceTypeId(value: string): InvoiceTypeId {
  if (value === 'dimension') {
    return 'volume';
  }
  return isInvoiceTypeId(value) ? value : 'general';
}
