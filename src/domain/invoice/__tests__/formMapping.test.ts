import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';

import {
  addDaysIso,
  formValuesToInvoiceDetails,
  formValuesToInvoiceLineInput,
  invoiceLineToFormDefaults,
  invoiceToDetailsFormDefaults,
  todayIsoDate,
} from '../formMapping';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceItemInput } from '../types';

const GENERAL_CONFIG = resolveInvoiceFieldConfig({ invoiceTypeId: 'general', customFieldKeys: [] });

describe('invoiceLineToFormDefaults', () => {
  it('defaults to the empty line when null', () => {
    expect(invoiceLineToFormDefaults(null)).toEqual(
      expect.objectContaining({ itemName: '', quantity: '1', unitPrice: '0' }),
    );
  });

  it('round-trips a fully populated line', () => {
    const line: InvoiceItemInput = {
      ...EMPTY_INVOICE_ITEM_INPUT,
      itemId: 'item_1',
      itemName: 'Widget',
      description: 'A widget',
      quantity: 3,
      unitPrice: 12.5,
      discountPercent: 5,
      taxPercent: 8,
    };
    expect(invoiceLineToFormDefaults(line)).toEqual({
      itemName: 'Widget',
      description: 'A widget',
      sku: '',
      quantity: '3',
      unit: '',
      weight: '',
      weightUnit: '',
      length: '',
      width: '',
      height: '',
      lengthUnit: '',
      timeUnit: '',
      priceMode: 'unit',
      totalPrice: '',
      unitPrice: '12.5',
      discountPercent: '5',
      taxPercent: '8',
    });
  });
});

describe('formValuesToInvoiceLineInput', () => {
  it('preserves the passed-in itemId and nulls out fields outside the field set', () => {
    const values = {
      itemName: 'Widget',
      description: 'desc',
      sku: 'SKU',
      quantity: 2,
      unit: 'pcs',
      weight: 5,
      weightUnit: null,
      length: null,
      width: null,
      height: null,
      lengthUnit: null,
      timeUnit: null,
      priceMode: 'unit' as const,
      unitPrice: 10,
      totalPrice: null,
      discountPercent: null,
      taxPercent: 8,
    };
    const result = formValuesToInvoiceLineInput(values, 'item_9', GENERAL_CONFIG);
    expect(result.itemId).toBe('item_9');
    // General's field list has no "weight" field, so it's dropped even though the raw value was set.
    expect(result.weight).toBeNull();
    expect(result.quantity).toBe(2);
    expect(result.discountPercent).toBe(0); // active field, default to 0 when unset
  });

  it('supports a manual line with no catalog item (itemId null)', () => {
    const values = {
      itemName: 'Custom line',
      description: null,
      sku: null,
      quantity: 1,
      unit: null,
      weight: null,
      weightUnit: null,
      length: null,
      width: null,
      height: null,
      lengthUnit: null,
      timeUnit: null,
      priceMode: 'unit' as const,
      unitPrice: 50,
      totalPrice: null,
      discountPercent: null,
      taxPercent: null,
    };
    const result = formValuesToInvoiceLineInput(values, null, GENERAL_CONFIG);
    expect(result.itemId).toBeNull();
  });

  const baseValues = {
    itemName: 'Slab',
    description: null,
    sku: null,
    quantity: null,
    unit: null,
    weight: null,
    weightUnit: null,
    length: 10,
    width: 10,
    height: null,
    lengthUnit: 'ft',
    timeUnit: null,
    discountPercent: null,
    taxPercent: null,
  };

  it('keeps only the Total Item Price for a total-priced line (unit price zeroed, no stale value)', () => {
    const result = formValuesToInvoiceLineInput(
      { ...baseValues, priceMode: 'total', unitPrice: 12, totalPrice: 900 },
      null,
      GENERAL_CONFIG,
    );
    expect(result.priceMode).toBe('total');
    expect(result.totalPrice).toBe(900);
    expect(result.unitPrice).toBe(0);
  });

  it('keeps only the Unit Price for a unit-priced line (a leftover total price is dropped)', () => {
    const result = formValuesToInvoiceLineInput(
      { ...baseValues, priceMode: 'unit', unitPrice: 8, totalPrice: 900 },
      null,
      GENERAL_CONFIG,
    );
    expect(result.priceMode).toBe('unit');
    expect(result.unitPrice).toBe(8);
    expect(result.totalPrice).toBeNull();
  });
});

describe('invoiceLineToFormDefaults price mode', () => {
  it('defaults a new/legacy line to unit mode with its unit price', () => {
    const defaults = invoiceLineToFormDefaults({ ...EMPTY_INVOICE_ITEM_INPUT, unitPrice: 25 });
    expect(defaults.priceMode).toBe('unit');
    expect(defaults.unitPrice).toBe('25');
    expect(defaults.totalPrice).toBe('');
  });

  it('loads a total-priced line back with its Total Item Price and a blank unit price', () => {
    const defaults = invoiceLineToFormDefaults({
      ...EMPTY_INVOICE_ITEM_INPUT,
      priceMode: 'total',
      unitPrice: 0,
      totalPrice: 900,
    });
    expect(defaults.priceMode).toBe('total');
    expect(defaults.totalPrice).toBe('900');
    expect(defaults.unitPrice).toBe('');
  });
});

describe('invoiceToDetailsFormDefaults / formValuesToInvoiceDetails', () => {
  it('defaults issue date to today when creating new', () => {
    const defaults = invoiceToDetailsFormDefaults(null);
    expect(defaults.issueDate).toBe(todayIsoDate());
    expect(defaults.dueDate).toBe('');
  });

  it('round-trips an existing invoice’s dates/notes/terms', () => {
    const defaults = invoiceToDetailsFormDefaults({
      issueDate: '2026-06-01',
      dueDate: '2026-06-15',
      notes: 'Thanks!',
      terms: 'Net 15',
    });
    expect(defaults).toEqual({
      issueDate: '2026-06-01',
      dueDate: '2026-06-15',
      notes: 'Thanks!',
      terms: 'Net 15',
    });
  });

  it('addDaysIso adds calendar days without drifting across month/year boundaries', () => {
    expect(addDaysIso('2026-06-01', 30)).toBe('2026-07-01');
    expect(addDaysIso('2026-12-20', 15)).toBe('2027-01-04');
    expect(addDaysIso('2026-06-01', 0)).toBe('2026-06-01');
  });

  it('maps validated output straight through', () => {
    const output = formValuesToInvoiceDetails({
      issueDate: '2026-06-01',
      dueDate: null,
      notes: null,
      terms: null,
    });
    expect(output).toEqual({ issueDate: '2026-06-01', dueDate: null, notes: null, terms: null });
  });
});
