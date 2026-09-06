import {
  INVOICE_TYPE_IDS,
  INVOICE_TYPE_REGISTRY,
  getInvoiceTypeDefinition,
  isInvoiceTypeId,
} from '../invoiceTypeRegistry';

describe('invoiceTypeRegistry', () => {
  it('lists the five initial types from the brief', () => {
    expect(INVOICE_TYPE_IDS).toEqual(['general', 'quantity', 'weight', 'dimension', 'custom']);
  });

  it('matches the field matrix from the brief for each fixed type', () => {
    expect(getInvoiceTypeDefinition('general').fields).toEqual([
      'itemName',
      'quantity',
      'unit',
      'unitPrice',
      'discount',
      'tax',
    ]);
    expect(getInvoiceTypeDefinition('quantity').fields).toEqual([
      'itemName',
      'quantity',
      'unit',
      'unitPrice',
      'discount',
      'tax',
    ]);
    expect(getInvoiceTypeDefinition('weight').fields).toEqual([
      'itemName',
      'quantity',
      'weight',
      'unitPrice',
      'discount',
      'tax',
    ]);
    expect(getInvoiceTypeDefinition('dimension').fields).toEqual([
      'itemName',
      'quantity',
      'length',
      'width',
      'height',
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
    expect(isInvoiceTypeId('bogus')).toBe(false);
  });

  it('every registry entry has a label and description', () => {
    for (const def of INVOICE_TYPE_REGISTRY) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });
});
