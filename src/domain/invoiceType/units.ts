/**
 * Unit support for the pricing methods that measure a physical quantity
 * (WEIGHT, LENGTH/AREA/VOLUME, TIME) — see `MVP_BUILD_PLAN.md`'s Pricing
 * Method brief, §2 ("Supported weight units should include kg/g/lb/oz…").
 *
 * Each table maps a unit to its conversion factor into one canonical base
 * unit for that measurement kind (kg for weight, metres for length/area/
 * volume, minutes for time). `convertMeasurement` is the one place a value
 * ever moves between units — used when a catalog item's default unit differs
 * from the unit chosen on an invoice line, so the physical quantity survives
 * unit changes instead of being silently reinterpreted in the new unit.
 *
 * Deliberately NOT used to convert between the *measurement* unit and the
 * *price* unit within a single calculation — every worked example in the
 * brief (25kg × £3/kg, 15m × £4/m, 5m × 4m × £25/m²…) prices per the same
 * unit the quantity is entered in, which is exactly what
 * `domain/invoice/calculations.ts` assumes.
 */

export type MeasurementKind = 'weight' | 'length' | 'time';

export type WeightUnit = 'kg' | 'g' | 'lb' | 'oz';
export type LengthUnit = 'm' | 'cm' | 'mm' | 'ft' | 'in' | 'yd';
export type TimeUnit = 'minute' | 'hour' | 'day';

export interface UnitOption<TUnit extends string> {
  value: TUnit;
  label: string;
  /** Multiply a quantity in this unit by this factor to get the base unit. */
  toBaseFactor: number;
}

/** Base unit: kilogram. */
export const WEIGHT_UNITS: UnitOption<WeightUnit>[] = [
  { value: 'kg', label: 'kg', toBaseFactor: 1 },
  { value: 'g', label: 'g', toBaseFactor: 0.001 },
  { value: 'lb', label: 'lb', toBaseFactor: 0.45359237 },
  { value: 'oz', label: 'oz', toBaseFactor: 0.028349523125 },
];

/** Base unit: metre (also used for AREA/VOLUME's length/width/height fields). */
export const LENGTH_UNITS: UnitOption<LengthUnit>[] = [
  { value: 'm', label: 'm', toBaseFactor: 1 },
  { value: 'cm', label: 'cm', toBaseFactor: 0.01 },
  { value: 'mm', label: 'mm', toBaseFactor: 0.001 },
  { value: 'ft', label: 'ft', toBaseFactor: 0.3048 },
  { value: 'in', label: 'in', toBaseFactor: 0.0254 },
  { value: 'yd', label: 'yd', toBaseFactor: 0.9144 },
];

/** Base unit: minute. */
export const TIME_UNITS: UnitOption<TimeUnit>[] = [
  { value: 'minute', label: 'minute', toBaseFactor: 1 },
  { value: 'hour', label: 'hour', toBaseFactor: 60 },
  { value: 'day', label: 'day', toBaseFactor: 1440 },
];

export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'kg';
export const DEFAULT_LENGTH_UNIT: LengthUnit = 'm';
export const DEFAULT_TIME_UNIT: TimeUnit = 'hour';

/**
 * Dropdown choices for the generic `unit` field (General/Quantity/Service —
 * "e.g. pcs, box, hr"). Replaces what used to be a free-text input; unlike
 * `WEIGHT_UNITS`/`LENGTH_UNITS`/`TIME_UNITS` these aren't tied to a
 * conversion table since nothing ever converts a "box" into a "pcs".
 */
export const GENERIC_UNITS: { value: string; label: string }[] = [
  { value: 'pcs', label: 'pcs' },
  { value: 'unit', label: 'unit' },
  { value: 'box', label: 'box' },
  { value: 'pack', label: 'pack' },
  { value: 'set', label: 'set' },
  { value: 'dozen', label: 'dozen' },
  { value: 'hr', label: 'hr' },
  { value: 'kg', label: 'kg' },
  { value: 'ltr', label: 'ltr' },
  { value: 'm', label: 'm' },
];

const UNIT_TABLES: Record<MeasurementKind, UnitOption<string>[]> = {
  weight: WEIGHT_UNITS,
  length: LENGTH_UNITS,
  time: TIME_UNITS,
};

export function unitsFor(kind: MeasurementKind): UnitOption<string>[] {
  return UNIT_TABLES[kind];
}

export function isKnownUnit(kind: MeasurementKind, value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return UNIT_TABLES[kind].some((unit) => unit.value === value);
}

function factorFor(kind: MeasurementKind, unit: string): number {
  const found = UNIT_TABLES[kind].find((option) => option.value === unit);
  if (!found) {
    throw new Error(`Unknown ${kind} unit: ${unit}`);
  }
  return found.toBaseFactor;
}

/**
 * Converts a value from one unit to another within the same measurement
 * kind — e.g. `convertMeasurement(25, 'g', 'kg', 'weight') === 0.025`.
 * Returns `value` unchanged when the units are already the same (also
 * covers "unit unknown/not set yet", so a not-fully-filled-in form never
 * throws while the user is still typing).
 */
export function convertMeasurement(
  value: number,
  fromUnit: string | null | undefined,
  toUnit: string | null | undefined,
  kind: MeasurementKind,
): number {
  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return value;
  }
  const baseValue = value * factorFor(kind, fromUnit);
  return baseValue / factorFor(kind, toUnit);
}
