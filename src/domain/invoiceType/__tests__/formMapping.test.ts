import { ALL_FIELD_KEYS } from '../fieldCatalog';
import { describeFixedTypeFields, describeSelectionFields, selectionToCustomFormDefaults } from '../formMapping';
import type { InvoiceTypeSelection } from '../types';

describe('selectionToCustomFormDefaults', () => {
  it('defaults to item, quantity, unit price and tax when nothing was ever configured', () => {
    const defaults = selectionToCustomFormDefaults(null);
    const checked = ALL_FIELD_KEYS.filter((key) => defaults[key]);
    expect(checked).toEqual(['itemName', 'quantity', 'unitPrice', 'tax']);
  });

  it('defaults the same way for a saved selection that is not "custom" yet', () => {
    const selection: InvoiceTypeSelection = {
      invoiceTypeId: 'general',
      customFieldKeys: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const checked = ALL_FIELD_KEYS.filter((key) => selectionToCustomFormDefaults(selection)[key]);
    expect(checked).toEqual(['itemName', 'quantity', 'unitPrice', 'tax']);
  });

  it('reflects a previously saved custom selection', () => {
    const selection: InvoiceTypeSelection = {
      invoiceTypeId: 'custom',
      customFieldKeys: ['description', 'sku', 'itemName', 'unitPrice'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const checked = ALL_FIELD_KEYS.filter((key) => selectionToCustomFormDefaults(selection)[key]);
    expect(checked).toEqual(['itemName', 'description', 'sku', 'unitPrice']);
  });
});

describe('describeSelectionFields / describeFixedTypeFields', () => {
  it('formats a fixed type field list as a readable label list', () => {
    expect(describeSelectionFields({ invoiceTypeId: 'dimension', customFieldKeys: [] })).toBe(
      'Item Name, Quantity, Length, Width, Height, Unit Price, Discount, Tax',
    );
  });

  it('formats a custom selection', () => {
    expect(
      describeSelectionFields({ invoiceTypeId: 'custom', customFieldKeys: ['itemName', 'unitPrice'] }),
    ).toBe('Item Name, Unit Price');
  });

  it('describeFixedTypeFields formats a raw key list the same way', () => {
    expect(describeFixedTypeFields(['itemName', 'weight', 'unitPrice'])).toBe(
      'Item Name, Weight, Unit Price',
    );
  });
});
