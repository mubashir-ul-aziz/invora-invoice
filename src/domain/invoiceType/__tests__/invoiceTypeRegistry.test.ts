import {
  INVOICE_TYPE_IDS,
  INVOICE_TYPE_REGISTRY,
  getInvoiceTypeDefinition,
  isInvoiceTypeId,
} from '../invoiceTypeRegistry';

describe('invoiceTypeRegistry', () => {
  it('lists the nine pricing methods from the brief', () => {
    expect(INVOICE_TYPE_IDS).toEqual([
      'general',
      'quantity',
      'weight',
      'length',
      'area',
      'volume',
      'time',
      'service',
      'custom',
    ]);
  });

  it('matches the field matrix from the brief for each fixed method', () => {
    expect(getInvoiceTypeDefinition('general').fields).toEqual([
      'itemName',
      'description',
      'sku',
      'quantity',
      'unit',
      'unitPrice',
      'discount',
      'tax',
    ]);
    expect(getInvoiceTypeDefinition('quantity').fields).toEqual([
      'itemName',
      'description',
      'sku',
      'quantity',
      'unit',
      'unitPrice',
      'discount',
      'tax',
    ]);
    expect(getInvoiceTypeDefinition('weight').fields).toEqual([
      'itemName',
      'description',
      'sku',
      'weight',
      'weightUnit',
      'unitPrice',
      'discount',
      'tax',
    ]);
    expect(getInvoiceTypeDefinition('length').fields).toEqual([
      'itemName',
      'description',
      'sku',
      'length',
      'lengthUnit',
      'unitPrice',
      'discount',
      'tax',
    ]);
    expect(getInvoiceTypeDefinition('area').fields).toEqual([
      'itemName',
      'description',
      'sku',
      'length',
      'width',
      'lengthUnit',
      'unitPrice',
      'discount',
      'tax',
    ]);
    expect(getInvoiceTypeDefinition('volume').fields).toEqual([
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
    ]);
    expect(getInvoiceTypeDefinition('time').fields).toEqual([
      'itemName',
      'description',
      'quantity',
      'timeUnit',
      'unitPrice',
      'discount',
      'tax',
    ]);
    expect(getInvoiceTypeDefinition('service').fields).toEqual([
      'itemName',
      'description',
      'sku',
      'quantity',
      'unit',
      'unitPrice',
      'discount',
      'tax',
    ]);
  });

  it('leaves "custom" configurable (no fixed field list)', () => {
    expect(getInvoiceTypeDefinition('custom').fields).toBeNull();
  });

  it('throws for an unknown id', () => {
    // @ts-expect-error deliberately invalid id
    expect(() => getInvoiceTypeDefinition('bogus')).toThrow();
  });

  it('identifies valid vs invalid invoice type ids', () => {
    expect(isInvoiceTypeId('weight')).toBe(true);
    expect(isInvoiceTypeId('area')).toBe(true);
    expect(isInvoiceTypeId('dimension')).toBe(false);
    expect(isInvoiceTypeId('bogus')).toBe(false);
  });

  it('every registry entry has a label, description, calculation kind, and formula hint', () => {
    for (const def of INVOICE_TYPE_REGISTRY) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.calculationKind.length).toBeGreaterThan(0);
      expect(def.formulaHint.length).toBeGreaterThan(0);
    }
  });

  it('assigns the correct calculation kind to each measurement method', () => {
    expect(getInvoiceTypeDefinition('weight').calculationKind).toBe('weight');
    expect(getInvoiceTypeDefinition('length').calculationKind).toBe('length');
    expect(getInvoiceTypeDefinition('area').calculationKind).toBe('area');
    expect(getInvoiceTypeDefinition('volume').calculationKind).toBe('volume');
    expect(getInvoiceTypeDefinition('time').calculationKind).toBe('time');
    expect(getInvoiceTypeDefinition('general').calculationKind).toBe('quantityTimesPrice');
    expect(getInvoiceTypeDefinition('service').calculationKind).toBe('quantityTimesPrice');
  });
});
