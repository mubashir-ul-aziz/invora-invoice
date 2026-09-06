import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';
import type { Item } from '@/domain/item/types';

import { blankInvoiceLine, invoiceLineFromItem, reconcileInvoiceLineWithFieldConfig } from '../snapshot';

const GENERAL_CONFIG = resolveInvoiceFieldConfig({ invoiceTypeId: 'general', customFieldKeys: [] });
const DIMENSION_CONFIG = resolveInvoiceFieldConfig({ invoiceTypeId: 'dimension', customFieldKeys: [] });

const ITEM: Item = {
  id: 'item_1',
  name: 'Steel Pipe',
  description: 'Galvanized steel pipe',
  sku: 'SKU-1',
  unit: 'pcs',
  defaultPrice: 25,
  taxRate: 8,
  weight: 5,
  length: 100,
  width: 10,
  height: 10,
  invoiceTypeId: 'general',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('invoiceLineFromItem', () => {
  it('copies plain values from the item as a snapshot — not a reference', () => {
    const line = invoiceLineFromItem(ITEM, GENERAL_CONFIG);
    expect(line.itemId).toBe('item_1');
    expect(line.itemName).toBe('Steel Pipe');
    expect(line.unitPrice).toBe(25);
    expect(line.taxPercent).toBe(8);
    expect(line.quantity).toBe(1);
    expect(line.discountPercent).toBe(0);
  });

  it('only copies physical fields the invoice type actually includes', () => {
    const generalLine = invoiceLineFromItem(ITEM, GENERAL_CONFIG);
    expect(generalLine.weight).toBeNull();
    expect(generalLine.length).toBeNull();

    const dimensionLine = invoiceLineFromItem(ITEM, DIMENSION_CONFIG);
    expect(dimensionLine.length).toBe(100);
    expect(dimensionLine.width).toBe(10);
    expect(dimensionLine.height).toBe(10);
    // Dimension's field list has no "unit" field.
    expect(dimensionLine.unit).toBeNull();
  });

  it('mutating the item afterwards never changes an already-built line', () => {
    const line = invoiceLineFromItem(ITEM, GENERAL_CONFIG);
    const renamed: Item = { ...ITEM, name: 'Steel Tube', defaultPrice: 999 };
    invoiceLineFromItem(renamed, GENERAL_CONFIG); // building a *new* line from the renamed item...
    expect(line.itemName).toBe('Steel Pipe'); // ...never touches the earlier one.
    expect(line.unitPrice).toBe(25);
  });
});

describe('blankInvoiceLine', () => {
  it('starts empty with no catalog item behind it', () => {
    const line = blankInvoiceLine(GENERAL_CONFIG);
    expect(line.itemId).toBeNull();
    expect(line.itemName).toBe('');
    expect(line.unitPrice).toBe(0);
    expect(line.quantity).toBe(1);
  });

  it('nulls out quantity when the invoice type does not include it', () => {
    const customConfig = resolveInvoiceFieldConfig({
      invoiceTypeId: 'custom',
      customFieldKeys: ['itemName', 'unitPrice'],
    });
    const line = blankInvoiceLine(customConfig);
    expect(line.quantity).toBeNull();
    expect(line.discountPercent).toBeNull();
  });
});

describe('reconcileInvoiceLineWithFieldConfig', () => {
  it('nulls out fields that are no longer part of the invoice type', () => {
    const dimensionLine = invoiceLineFromItem(ITEM, DIMENSION_CONFIG);
    expect(dimensionLine.length).toBe(100);

    const reconciled = reconcileInvoiceLineWithFieldConfig(dimensionLine, GENERAL_CONFIG);
    expect(reconciled.length).toBeNull();
    expect(reconciled.width).toBeNull();
    expect(reconciled.height).toBeNull();
    // General has "unit", which the dimension line never populated — reconciling doesn't invent a value.
    expect(reconciled.unit).toBeNull();
    // Fields both configs share are left untouched.
    expect(reconciled.itemName).toBe('Steel Pipe');
    expect(reconciled.unitPrice).toBe(25);
  });

  it('defaults quantity/discount back on when switching into a type that includes them', () => {
    const customConfig = resolveInvoiceFieldConfig({
      invoiceTypeId: 'custom',
      customFieldKeys: ['itemName', 'unitPrice'],
    });
    const line = blankInvoiceLine(customConfig); // quantity/discount null under this config
    const reconciled = reconcileInvoiceLineWithFieldConfig(line, GENERAL_CONFIG);
    expect(reconciled.quantity).toBe(1);
    expect(reconciled.discountPercent).toBe(0);
  });
});
