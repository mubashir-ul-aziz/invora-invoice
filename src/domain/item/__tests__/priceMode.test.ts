import { blankInvoiceLine, invoiceLineFromItem } from '@/domain/invoice/snapshot';
import { calculateLineTotal, toLineCalcInput } from '@/domain/invoice/calculations';
import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';

import { formValuesToItemInput, itemToFormDefaults } from '../formMapping';
import { EMPTY_ITEM_INPUT, type Item } from '../types';
import { itemFormSchema } from '../validation';

const AREA_CONFIG = resolveInvoiceFieldConfig({ invoiceTypeId: 'area', customFieldKeys: [] });

const areaItem = (overrides: Partial<Item> = {}): Item => ({
  ...EMPTY_ITEM_INPUT,
  id: 'item_1',
  name: 'Patio slab',
  invoiceTypeId: 'area',
  length: 10,
  width: 10,
  lengthUnit: 'ft',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('item price mode', () => {
  const form = {
    name: 'Patio slab',
    description: '',
    sku: '',
    unit: '',
    defaultPrice: '900',
    taxRate: '',
    weight: '',
    weightUnit: '',
    length: '10',
    width: '10',
    height: '',
    lengthUnit: 'ft',
    invoiceTypeId: 'area' as const,
  };

  it('validates and maps a Total Item Price item', () => {
    const parsed = itemFormSchema.safeParse({ ...form, priceMode: 'total' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const input = formValuesToItemInput(parsed.data);
      expect(input.priceMode).toBe('total');
      expect(input.defaultPrice).toBe(900);
    }
  });

  it('a form without priceMode validates as unit (pre-toggle forms)', () => {
    const parsed = itemFormSchema.safeParse(form);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.priceMode).toBe('unit');
    }
  });

  it('loads an item back into the form with its mode (legacy items default to unit)', () => {
    expect(itemToFormDefaults(areaItem({ priceMode: 'total' })).priceMode).toBe('total');
    const legacy = areaItem();
    delete legacy.priceMode;
    expect(itemToFormDefaults(legacy).priceMode).toBe('unit');
  });

  it('a unit-priced item prefills Unit Price on the invoice line: 100 ft² × $8 = $800', () => {
    const line = invoiceLineFromItem(areaItem({ defaultPrice: 8, priceMode: 'unit' }), AREA_CONFIG);
    expect(line.priceMode).toBe('unit');
    expect(line.unitPrice).toBe(8);
    expect(line.totalPrice).toBeNull();
    expect(calculateLineTotal(toLineCalcInput(line), 'area').lineTotal).toBe(800);
  });

  it('a total-priced item prefills Total Item Price on the invoice line: 100 ft² for $900 = $900, not $90,000', () => {
    const line = invoiceLineFromItem(areaItem({ defaultPrice: 900, priceMode: 'total' }), AREA_CONFIG);
    expect(line.priceMode).toBe('total');
    expect(line.unitPrice).toBe(0);
    expect(line.totalPrice).toBe(900);
    expect(calculateLineTotal(toLineCalcInput(line), 'area').lineTotal).toBe(900);
  });

  it('a legacy item (no priceMode) still adds as a unit-priced line', () => {
    const legacy = areaItem({ defaultPrice: 8 });
    delete legacy.priceMode;
    expect(invoiceLineFromItem(legacy, AREA_CONFIG).priceMode).toBe('unit');
  });

  it('a blank manual line starts in unit mode', () => {
    expect(blankInvoiceLine(AREA_CONFIG).priceMode).toBe('unit');
  });
});
