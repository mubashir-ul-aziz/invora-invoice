import {
  ALL_FIELD_KEYS,
  ALWAYS_INCLUDED_FIELD_KEYS,
  FIELD_DEFINITIONS,
  getFieldDefinition,
  isFieldKey,
} from '../fieldCatalog';

describe('fieldCatalog', () => {
  it('exposes exactly the fifteen fields the brief lists (including the weight/length/time unit selectors)', () => {
    expect(ALL_FIELD_KEYS.sort()).toEqual(
      [
        'itemName',
        'description',
        'sku',
        'quantity',
        'unit',
        'weight',
        'weightUnit',
        'length',
        'width',
        'height',
        'lengthUnit',
        'timeUnit',
        'unitPrice',
        'discount',
        'tax',
      ].sort(),
    );
  });

  it('marks item name and unit price as always included', () => {
    expect(ALWAYS_INCLUDED_FIELD_KEYS.sort()).toEqual(['itemName', 'unitPrice'].sort());
  });

  it('returns a field definition for every catalog key', () => {
    for (const key of ALL_FIELD_KEYS) {
      expect(getFieldDefinition(key)).toBe(FIELD_DEFINITIONS[key]);
    }
  });

  it('throws for an unknown key', () => {
    // @ts-expect-error deliberately invalid key
    expect(() => getFieldDefinition('bogus')).toThrow();
  });

  it('identifies valid vs invalid field keys', () => {
    expect(isFieldKey('quantity')).toBe(true);
    expect(isFieldKey('bogus')).toBe(false);
  });
});
