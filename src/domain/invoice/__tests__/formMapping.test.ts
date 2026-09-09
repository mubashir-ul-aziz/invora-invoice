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
      unitPrice: 10,
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
      unitPrice: 50,
      discountPercent: null,
      taxPercent: null,
    };
    const result = formValuesToInvoiceLineInput(values, null, GENERAL_CONFIG);
    expect(result.itemId).toBeNull();
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
