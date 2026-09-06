import { normalizeCustomFieldKeys, resolveInvoiceFieldConfig } from '../types';

describe('normalizeCustomFieldKeys', () => {
  it('de-dupes and sorts into canonical catalog order', () => {
    expect(normalizeCustomFieldKeys(['tax', 'itemName', 'tax', 'quantity'])).toEqual([
      'itemName',
      'quantity',
      'unitPrice',
      'tax',
    ]);
  });

  it('always includes item name and unit price even if omitted', () => {
    expect(normalizeCustomFieldKeys(['sku'])).toEqual(['itemName', 'sku', 'unitPrice']);
  });

  it('handles an empty list by returning just the always-included fields', () => {
    expect(normalizeCustomFieldKeys([])).toEqual(['itemName', 'unitPrice']);
  });
});

describe('resolveInvoiceFieldConfig', () => {
  it('resolves a fixed type to its registry field list', () => {
    const config = resolveInvoiceFieldConfig({ invoiceTypeId: 'weight', customFieldKeys: [] });
    expect(config.fields.map((f) => f.key)).toEqual([
      'itemName',
      'quantity',
      'weight',
      'unitPrice',
      'discount',
      'tax',
    ]);
  });

  it('resolves "custom" to the normalized custom field selection', () => {
    const config = resolveInvoiceFieldConfig({
      invoiceTypeId: 'custom',
      customFieldKeys: ['description', 'sku', 'unitPrice'],
    });
    expect(config.fields.map((f) => f.key)).toEqual(['itemName', 'description', 'sku', 'unitPrice']);
  });

  it('normalizes an empty custom selection down to just the always-included fields', () => {
    const config = resolveInvoiceFieldConfig({ invoiceTypeId: 'custom', customFieldKeys: [] });
    expect(config.fields.map((f) => f.key)).toEqual(['itemName', 'unitPrice']);
  });
});
