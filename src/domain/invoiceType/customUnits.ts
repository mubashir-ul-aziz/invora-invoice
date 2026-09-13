import { GENERIC_UNITS, LENGTH_UNITS, TIME_UNITS, WEIGHT_UNITS } from './units';

/**
 * The four places a "Unit" dropdown appears (the generic `unit` field, plus
 * the three measurement unit selectors). A business owner can extend any of
 * them with their own unit — see `BusinessRepository.addCustomUnit()` — on
 * top of the fixed catalog below, so "Kg, Gram, Pound…" style built-ins never
 * have to anticipate every unit a real business might sell in.
 */
export type UnitFieldKind = 'generic' | 'weight' | 'length' | 'time';

export type CustomUnitsMap = Record<UnitFieldKind, string[]>;

export const EMPTY_CUSTOM_UNITS: CustomUnitsMap = {
  generic: [],
  weight: [],
  length: [],
  time: [],
};

export const UNIT_FIELD_KINDS: UnitFieldKind[] = ['generic', 'weight', 'length', 'time'];

export function isUnitFieldKind(value: string): value is UnitFieldKind {
  return (UNIT_FIELD_KINDS as string[]).includes(value);
}

/** The fixed dropdown choices for one unit kind, before any business-added custom units are merged in. */
export function baseUnitOptionsFor(kind: UnitFieldKind): { value: string; label: string }[] {
  switch (kind) {
    case 'generic':
      return GENERIC_UNITS;
    case 'weight':
      return WEIGHT_UNITS.map((u) => ({ value: u.value, label: u.label }));
    case 'length':
      return LENGTH_UNITS.map((u) => ({ value: u.value, label: u.label }));
    case 'time':
      return TIME_UNITS.map((u) => ({ value: u.value, label: u.label }));
  }
}

/**
 * Combines a kind's fixed options with its business-added custom units,
 * de-duplicating case-insensitively — a custom unit that just re-types an
 * existing choice (e.g. "KG" when "kg" is already a base option) never shows
 * up twice.
 */
export function mergeUnitOptions(
  base: { value: string; label: string }[],
  customUnits: string[],
): { value: string; label: string }[] {
  const seen = new Set(base.map((option) => option.value.trim().toLowerCase()));
  const merged = [...base];
  for (const unit of customUnits) {
    const key = unit.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({ value: unit.trim(), label: unit.trim() });
  }
  return merged;
}

/**
 * Adds one new custom unit to a kind's existing list, trimming whitespace and
 * skipping it (returning `existing` unchanged) when it's blank or already
 * present — either as a base option or a previously-added custom one — so
 * the same unit can never be saved twice under different casing.
 */
export function addCustomUnitToList(
  existing: string[],
  label: string,
  base: { value: string; label: string }[],
): string[] {
  const trimmed = label.trim();
  if (!trimmed) {
    return existing;
  }
  const key = trimmed.toLowerCase();
  const alreadyKnown =
    base.some((option) => option.value.trim().toLowerCase() === key) ||
    existing.some((unit) => unit.trim().toLowerCase() === key);
  if (alreadyKnown) {
    return existing;
  }
  return [...existing, trimmed];
}

/** Parses the `custom_units` JSON column, tolerating null/malformed values — same defensive shape as `parseCustomFieldKeys`. */
export function parseCustomUnitsMap(raw: string | null | undefined): CustomUnitsMap {
  if (!raw) {
    return { ...EMPTY_CUSTOM_UNITS };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...EMPTY_CUSTOM_UNITS };
    }
    const result: CustomUnitsMap = { ...EMPTY_CUSTOM_UNITS };
    for (const kind of UNIT_FIELD_KINDS) {
      const value = (parsed as Record<string, unknown>)[kind];
      if (Array.isArray(value)) {
        result[kind] = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      }
    }
    return result;
  } catch {
    return { ...EMPTY_CUSTOM_UNITS };
  }
}
