import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';
import type { InvoiceItemSnapshot } from '@/domain/invoice/types';

import { getPdfItemColumns } from '../itemColumns';

const baseItem: InvoiceItemSnapshot = {
  id: 'line-1',
  itemId: null,
  itemName: 'Steel Pipe',
  description: null,
  sku: null,
  quantity: 2,
  unit: 'pcs',
  weight: null,
  length: null,
  width: null,
  height: null,
  unitPrice: 100,
  discountPercent: null,
  taxPercent: null,
  subtotal: 200,
  discountAmount: 0,
  taxAmount: 0,
  lineTotal: 200,
};

describe('getPdfItemColumns', () => {
  it('always includes Item, Unit price, and Total', () => {
    const config = resolveInvoiceFieldConfig({ invoiceTypeId: 'general', customFieldKeys: [] });
    const keys = getPdfItemColumns(config).map((c) => c.key);
    expect(keys).toEqual(['itemName', 'quantity', 'unit', 'discount', 'tax', 'unitPrice', 'total']);
  });

  it('adds a Weight column only when the invoice type includes it ("weight when applicable")', () => {
    const withoutWeight = resolveInvoiceFieldConfig({ invoiceTypeId: 'general', customFieldKeys: [] });
    const withWeight = resolveInvoiceFieldConfig({ invoiceTypeId: 'weight', customFieldKeys: [] });
    expect(getPdfItemColumns(withoutWeight).some((c) => c.key === 'weight')).toBe(false);
    expect(getPdfItemColumns(withWeight).some((c) => c.key === 'weight')).toBe(true);
  });

  it('adds Length/Width/Height columns only for the Dimension type ("dimensions when applicable")', () => {
    const config = resolveInvoiceFieldConfig({ invoiceTypeId: 'dimension', customFieldKeys: [] });
    const keys = getPdfItemColumns(config).map((c) => c.key);
    expect(keys).toEqual(
      expect.arrayContaining(['length', 'width', 'height']),
    );
  });

  it('respects a Custom selection that only picked a subset of optional fields', () => {
    const config = resolveInvoiceFieldConfig({
      invoiceTypeId: 'custom',
      customFieldKeys: ['itemName', 'unitPrice', 'sku'],
    });
    const keys = getPdfItemColumns(config).map((c) => c.key);
    expect(keys).toEqual(['itemName', 'sku', 'unitPrice', 'total']);
  });

  it('renders each column\'s value from the item snapshot', () => {
    const config = resolveInvoiceFieldConfig({ invoiceTypeId: 'general', customFieldKeys: [] });
    const columns = getPdfItemColumns(config);
    const itemName = columns.find((c) => c.key === 'itemName')!;
    const unitPrice = columns.find((c) => c.key === 'unitPrice')!;
    const total = columns.find((c) => c.key === 'total')!;
    expect(itemName.render(baseItem, 'USD')).toBe('Steel Pipe');
    expect(unitPrice.render(baseItem, 'USD')).toBe('USD 100.00');
    expect(total.render(baseItem, 'USD')).toBe('USD 200.00');
  });
});
