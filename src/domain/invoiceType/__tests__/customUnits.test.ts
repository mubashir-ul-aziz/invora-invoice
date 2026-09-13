import {
  addCustomUnitToList,
  baseUnitOptionsFor,
  mergeUnitOptions,
  parseCustomUnitsMap,
} from '../customUnits';

describe('baseUnitOptionsFor', () => {
  it('returns the fixed generic unit choices', () => {
    expect(baseUnitOptionsFor('generic').map((o) => o.value)).toContain('pcs');
  });

  it('returns the real weight unit table', () => {
    expect(baseUnitOptionsFor('weight').map((o) => o.value)).toEqual(['kg', 'g', 'lb', 'oz']);
  });
});

describe('mergeUnitOptions', () => {
  it('appends custom units after the base list', () => {
    const merged = mergeUnitOptions(baseUnitOptionsFor('generic'), ['roll', 'sqft']);
    expect(merged.map((o) => o.value)).toEqual(['pcs', 'unit', 'box', 'pack', 'set', 'dozen', 'hr', 'kg', 'ltr', 'm', 'roll', 'sqft']);
  });

  it('de-duplicates a custom unit that re-types an existing base option, case-insensitively', () => {
    const merged = mergeUnitOptions(baseUnitOptionsFor('generic'), ['PCS', 'roll']);
    expect(merged.filter((o) => o.value.toLowerCase() === 'pcs')).toHaveLength(1);
    expect(merged.map((o) => o.value)).toContain('roll');
  });

  it('ignores blank custom units', () => {
    const merged = mergeUnitOptions(baseUnitOptionsFor('generic'), ['  ']);
    expect(merged).toHaveLength(baseUnitOptionsFor('generic').length);
  });
});

describe('addCustomUnitToList', () => {
  const base = baseUnitOptionsFor('generic');

  it('adds a new unit, trimmed', () => {
    expect(addCustomUnitToList([], '  roll  ', base)).toEqual(['roll']);
  });

  it('is a no-op for a unit that already exists in the base catalog (case-insensitive)', () => {
    expect(addCustomUnitToList([], 'PCS', base)).toEqual([]);
  });

  it('is a no-op for a unit already added previously', () => {
    expect(addCustomUnitToList(['roll'], 'Roll', base)).toEqual(['roll']);
  });

  it('is a no-op for a blank label', () => {
    expect(addCustomUnitToList(['roll'], '   ', base)).toEqual(['roll']);
  });

  it('never produces duplicates across repeated additions', () => {
    let units: string[] = [];
    units = addCustomUnitToList(units, 'bag', base);
    units = addCustomUnitToList(units, 'bag', base);
    units = addCustomUnitToList(units, 'Bag', base);
    expect(units).toEqual(['bag']);
  });
});

describe('parseCustomUnitsMap', () => {
  it('returns empty lists for null/malformed input', () => {
    expect(parseCustomUnitsMap(null)).toEqual({ generic: [], weight: [], length: [], time: [] });
    expect(parseCustomUnitsMap('not json')).toEqual({ generic: [], weight: [], length: [], time: [] });
  });

  it('round-trips a saved map', () => {
    const raw = JSON.stringify({ generic: ['roll'], weight: [], length: ['fathom'], time: [] });
    expect(parseCustomUnitsMap(raw)).toEqual({ generic: ['roll'], weight: [], length: ['fathom'], time: [] });
  });

  it('drops non-string entries and unknown kinds', () => {
    const raw = JSON.stringify({ generic: ['roll', 42, null], bogus: ['x'] });
    expect(parseCustomUnitsMap(raw)).toEqual({ generic: ['roll'], weight: [], length: [], time: [] });
  });
});
