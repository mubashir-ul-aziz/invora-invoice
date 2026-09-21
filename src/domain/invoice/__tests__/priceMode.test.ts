import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { describeCalculatedQuantity } from '@/domain/invoiceType/calculators';
import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';
import { getPdfItemColumns } from '@/domain/pdf/itemColumns';

import { calculateInvoiceTotals, calculateLineTotal, sumInvoiceTotals, toLineCalcInput } from '../calculations';
import { invoiceLineFormSchema, invoiceLineFormSchemaForPricingMethod } from '../validation';
import {
  EMPTY_INVOICE_ITEM_INPUT,
  invoiceItemInputFromSnapshot,
  normalizePriceMode,
  type InvoiceItemInput,
  type InvoiceItemSnapshot,
} from '../types';

const NO_ADJUSTMENTS = { discountPercent: null, taxPercent: null };

/** One row per pricing method: the measurements that produce `calculatedQuantity`, the unit price for the Unit Price case, and the flat Total Item Price for the other. */
const METHODS: {
  method: InvoiceTypeId;
  measurements: Partial<Pick<InvoiceItemInput, 'quantity' | 'weight' | 'length' | 'width' | 'height'>>;
  calculatedQuantity: number;
  unitPrice: number;
  totalPrice: number;
}[] = [
  { method: 'general', measurements: { quantity: 4 }, calculatedQuantity: 4, unitPrice: 25, totalPrice: 90 },
  { method: 'quantity', measurements: { quantity: 10 }, calculatedQuantity: 10, unitPrice: 5, totalPrice: 40 },
  { method: 'service', measurements: { quantity: 3 }, calculatedQuantity: 3, unitPrice: 80, totalPrice: 200 },
  { method: 'weight', measurements: { weight: 25 }, calculatedQuantity: 25, unitPrice: 4, totalPrice: 75 },
  { method: 'length', measurements: { length: 12 }, calculatedQuantity: 12, unitPrice: 7.5, totalPrice: 60 },
  { method: 'area', measurements: { length: 20, width: 10 }, calculatedQuantity: 200, unitPrice: 10, totalPrice: 900 },
  { method: 'volume', measurements: { length: 5, width: 4, height: 3 }, calculatedQuantity: 60, unitPrice: 12, totalPrice: 500 },
  { method: 'time', measurements: { quantity: 8 }, calculatedQuantity: 8, unitPrice: 45, totalPrice: 300 },
  { method: 'custom', measurements: { quantity: 6 }, calculatedQuantity: 6, unitPrice: 15, totalPrice: 70 },
];

const line = (
  measurements: (typeof METHODS)[number]['measurements'],
  price: { priceMode?: 'unit' | 'total'; unitPrice?: number; totalPrice?: number | null },
) => ({
  quantity: null,
  weight: null,
  length: null,
  width: null,
  height: null,
  ...measurements,
  ...NO_ADJUSTMENTS,
  priceMode: price.priceMode,
  unitPrice: price.unitPrice ?? 0,
  totalPrice: price.totalPrice ?? null,
});

describe('calculateLineTotal — every pricing method × both price modes', () => {
  it.each(METHODS)('$method: Unit Price = calculated quantity × unit price', ({ method, measurements, calculatedQuantity, unitPrice }) => {
    const result = calculateLineTotal(line(measurements, { priceMode: 'unit', unitPrice }), method);
    expect(result.calculatedQuantity).toBe(calculatedQuantity);
    expect(result.subtotal).toBe(calculatedQuantity * unitPrice);
    expect(result.lineTotal).toBe(calculatedQuantity * unitPrice);
  });

  it.each(METHODS)('$method: Total Item Price is the subtotal as-is, never multiplied by the quantity', ({ method, measurements, calculatedQuantity, totalPrice }) => {
    const result = calculateLineTotal(line(measurements, { priceMode: 'total', totalPrice }), method);
    // The measurement is still derived (for display) …
    expect(result.calculatedQuantity).toBe(calculatedQuantity);
    // … but the entered price is the whole item total.
    expect(result.subtotal).toBe(totalPrice);
    expect(result.lineTotal).toBe(totalPrice);
    if (calculatedQuantity !== 1) {
      expect(result.subtotal).not.toBe(calculatedQuantity * totalPrice);
    }
  });

  it.each(METHODS)('$method: ignores a stale unit price on a total-priced line', ({ method, measurements, totalPrice }) => {
    const result = calculateLineTotal(line(measurements, { priceMode: 'total', totalPrice, unitPrice: 9999 }), method);
    expect(result.subtotal).toBe(totalPrice);
  });

  it.each(METHODS)('$method: an absent price mode behaves exactly like Unit Price (pre-feature lines)', ({ method, measurements, calculatedQuantity, unitPrice }) => {
    const result = calculateLineTotal(line(measurements, { unitPrice }), method);
    expect(result.subtotal).toBe(calculatedQuantity * unitPrice);
  });

  it('AREA example from the spec: 20 ft × 10 ft = 200 ft², $10/ft² → $2,000', () => {
    const result = calculateLineTotal(line({ length: 20, width: 10 }, { priceMode: 'unit', unitPrice: 10 }), 'area');
    expect(result).toEqual({ calculatedQuantity: 200, subtotal: 2000, discountAmount: 0, taxAmount: 0, lineTotal: 2000 });
  });

  it('AREA example from the spec: 200 ft² with Total Item Price $2,000 → $2,000 (not 200 × $2,000)', () => {
    const result = calculateLineTotal(line({ length: 20, width: 10 }, { priceMode: 'total', totalPrice: 2000 }), 'area');
    expect(result).toEqual({ calculatedQuantity: 200, subtotal: 2000, discountAmount: 0, taxAmount: 0, lineTotal: 2000 });
  });

  it('applies discount then tax on top of a Total Item Price', () => {
    const result = calculateLineTotal(
      { ...line({ length: 10, width: 10 }, { priceMode: 'total', totalPrice: 900 }), discountPercent: 10, taxPercent: 20 },
      'area',
    );
    // subtotal 900, discount 90 -> taxable 810, tax 162 -> 972
    expect(result).toEqual({ calculatedQuantity: 100, subtotal: 900, discountAmount: 90, taxAmount: 162, lineTotal: 972 });
  });

  it('a total-priced line with no price entered yet is 0, never NaN or quantity-derived', () => {
    const result = calculateLineTotal(line({ length: 10, width: 10 }, { priceMode: 'total', totalPrice: null }), 'area');
    expect(result.subtotal).toBe(0);
    expect(result.lineTotal).toBe(0);
  });

  it('rounds a Total Item Price to the nearest cent', () => {
    const result = calculateLineTotal(line({ quantity: 3 }, { priceMode: 'total', totalPrice: 10.005 }), 'general');
    expect(result.subtotal).toBe(10.01);
  });

  it('toLineCalcInput carries the price mode and total price through (so no call site can drop them)', () => {
    const input = toLineCalcInput({
      ...EMPTY_INVOICE_ITEM_INPUT,
      length: 10,
      width: 10,
      priceMode: 'total',
      totalPrice: 900,
    });
    expect(calculateLineTotal(input, 'area').subtotal).toBe(900);
  });
});

describe('critical test — one Area invoice, three items, mixed price modes', () => {
  const item1 = line({ length: 20, width: 10 }, { priceMode: 'unit', unitPrice: 10 }); // 200 ft² × $10 = $2,000
  const item2 = line({ length: 15, width: 10 }, { priceMode: 'unit', unitPrice: 8 }); // 150 ft² × $8 = $1,200
  const item3 = line({ length: 10, width: 10 }, { priceMode: 'total', totalPrice: 900 }); // 100 ft², $900 flat

  it('sums to $4,100 — with no accidental $900 × 100', () => {
    const totals = calculateInvoiceTotals([item1, item2, item3], 'area');
    expect(totals.subtotal).toBe(4100);
    expect(totals.grandTotal).toBe(4100);
    expect(totals.subtotal).not.toBe(2000 + 1200 + 90000);
  });

  it('each line total is correct individually', () => {
    expect(calculateLineTotal(item1, 'area').lineTotal).toBe(2000);
    expect(calculateLineTotal(item2, 'area').lineTotal).toBe(1200);
    expect(calculateLineTotal(item3, 'area').lineTotal).toBe(900);
  });

  function areaInvoiceInput(): InvoiceItemInput[] {
    const base = { ...EMPTY_INVOICE_ITEM_INPUT, pricingMethodId: 'area' as const, quantity: null, lengthUnit: 'ft' };
    return [
      { ...base, itemName: 'Item 1', length: 20, width: 10, priceMode: 'unit', unitPrice: 10 },
      { ...base, itemName: 'Item 2', length: 15, width: 10, priceMode: 'unit', unitPrice: 8 },
      { ...base, itemName: 'Item 3', length: 10, width: 10, priceMode: 'total', unitPrice: 0, totalPrice: 900 },
    ];
  }

  const invoiceInput = (items: InvoiceItemInput[]) => ({
    customerId: 'cust_1',
    customerName: 'Acme',
    invoiceTypeId: 'area' as const,
    issueDate: '2026-06-01',
    dueDate: null,
    notes: null,
    terms: null,
    items,
  });

  it('persisting through the repository freezes the same numbers and the subtotal is $4,100', async () => {
    const repo = new InMemoryInvoiceRepository();
    const created = await repo.create('INV-1', invoiceInput(areaInvoiceInput()));

    expect(created.items.map((i) => i.lineTotal)).toEqual([2000, 1200, 900]);
    expect(created.items.map((i) => i.priceMode)).toEqual(['unit', 'unit', 'total']);
    expect(created.items[2].totalPrice).toBe(900);
    expect(created.items[2].unitPrice).toBe(0);
    expect(created.items[0].totalPrice).toBeNull();
    expect(sumInvoiceTotals(created.items).subtotal).toBe(4100);
  });

  it('editing the invoice (snapshot -> input -> update) keeps the Total Item Price line at $900', async () => {
    const repo = new InMemoryInvoiceRepository();
    const created = await repo.create('INV-1', invoiceInput(areaInvoiceInput()));

    const reloaded = created.items.map(invoiceItemInputFromSnapshot);
    const updated = await repo.update(created.id, {
      issueDate: created.issueDate,
      dueDate: created.dueDate,
      notes: created.notes,
      terms: created.terms,
      items: reloaded,
    });

    expect(updated.items.map((i) => i.lineTotal)).toEqual([2000, 1200, 900]);
    expect(sumInvoiceTotals(updated.items).subtotal).toBe(4100);
  });

  it('a duplicate of the invoice (same items re-saved as a new invoice) keeps the same totals', async () => {
    const repo = new InMemoryInvoiceRepository();
    const created = await repo.create('INV-1', invoiceInput(areaInvoiceInput()));
    const copy = await repo.create('INV-2', invoiceInput(created.items.map(invoiceItemInputFromSnapshot)));
    expect(sumInvoiceTotals(copy.items).subtotal).toBe(4100);
  });
});

describe('legacy lines (saved before price modes existed)', () => {
  it('normalizePriceMode treats absent/unknown values as unit', () => {
    expect(normalizePriceMode(undefined)).toBe('unit');
    expect(normalizePriceMode(null)).toBe('unit');
    expect(normalizePriceMode('')).toBe('unit');
    expect(normalizePriceMode('garbage')).toBe('unit');
    expect(normalizePriceMode('total')).toBe('total');
    expect(normalizePriceMode('unit')).toBe('unit');
  });

  it('a legacy input line without priceMode/totalPrice is saved as a unit-priced line', async () => {
    const repo = new InMemoryInvoiceRepository();
    const legacy = { ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Old', quantity: 2, unitPrice: 10 } as Partial<InvoiceItemInput>;
    delete legacy.priceMode;
    delete legacy.totalPrice;
    const created = await repo.create('INV-1', {
      customerId: 'c',
      customerName: 'C',
      invoiceTypeId: 'general',
      issueDate: '2026-06-01',
      dueDate: null,
      notes: null,
      terms: null,
      items: [legacy as InvoiceItemInput],
    });
    expect(created.items[0].priceMode).toBe('unit');
    expect(created.items[0].lineTotal).toBe(20);
  });
});

describe('invoice line form validation — price mode', () => {
  const base = {
    itemName: 'Slab',
    description: '',
    sku: '',
    quantity: '',
    unit: '',
    weight: '',
    weightUnit: '',
    length: '10',
    width: '10',
    height: '',
    lengthUnit: 'ft',
    timeUnit: '',
    discountPercent: '',
    taxPercent: '',
  };

  it('unit mode requires a unit price and does not require a total price', () => {
    expect(invoiceLineFormSchema.safeParse({ ...base, priceMode: 'unit', unitPrice: '10', totalPrice: '' }).success).toBe(true);
    const missing = invoiceLineFormSchema.safeParse({ ...base, priceMode: 'unit', unitPrice: '', totalPrice: '900' });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues.map((i) => i.path[0])).toContain('unitPrice');
    }
  });

  it('total mode requires a total price and does NOT require a unit price', () => {
    const ok = invoiceLineFormSchema.safeParse({ ...base, priceMode: 'total', unitPrice: '', totalPrice: '900' });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.totalPrice).toBe(900);
    }
    const missing = invoiceLineFormSchema.safeParse({ ...base, priceMode: 'total', unitPrice: '10', totalPrice: '' });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues.map((i) => i.path[0])).toContain('totalPrice');
    }
  });

  it('rejects a non-numeric or negative total price', () => {
    expect(invoiceLineFormSchema.safeParse({ ...base, priceMode: 'total', unitPrice: '', totalPrice: 'free' }).success).toBe(false);
    expect(invoiceLineFormSchema.safeParse({ ...base, priceMode: 'total', unitPrice: '', totalPrice: '-5' }).success).toBe(false);
  });

  it('a missing priceMode validates as unit mode (forms/tests that predate the toggle)', () => {
    const result = invoiceLineFormSchema.safeParse({ ...base, unitPrice: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceMode).toBe('unit');
    }
  });

  it('still enforces the pricing method’s measurement rules in total mode (AREA needs length and width)', () => {
    const schema = invoiceLineFormSchemaForPricingMethod('area');
    const ok = schema.safeParse({ ...base, priceMode: 'total', unitPrice: '', totalPrice: '900' });
    expect(ok.success).toBe(true);
    const noWidth = schema.safeParse({ ...base, width: '', priceMode: 'total', unitPrice: '', totalPrice: '900' });
    expect(noWidth.success).toBe(false);
  });

  it('applies the price-mode rules together with the method rules in the method-aware schema', () => {
    const schema = invoiceLineFormSchemaForPricingMethod('area');
    const result = schema.safeParse({ ...base, priceMode: 'unit', unitPrice: '', totalPrice: '900' });
    expect(result.success).toBe(false);
  });
});

describe('describeCalculatedQuantity', () => {
  const m = { quantity: null, weight: null, length: null, width: null, height: null };

  it('shows the calculated quantity with the right unit per method', () => {
    expect(describeCalculatedQuantity('general', { ...m, quantity: 4, unit: 'pcs' })).toBe('4 pcs');
    expect(describeCalculatedQuantity('quantity', { ...m, quantity: 10 })).toBe('10');
    expect(describeCalculatedQuantity('service', { ...m, quantity: 3, unit: 'job' })).toBe('3 job');
    expect(describeCalculatedQuantity('custom', { ...m, quantity: 6 })).toBe('6');
    expect(describeCalculatedQuantity('weight', { ...m, weight: 25, weightUnit: 'kg' })).toBe('25 kg');
    expect(describeCalculatedQuantity('length', { ...m, length: 12, lengthUnit: 'm' })).toBe('12 m');
    expect(describeCalculatedQuantity('area', { ...m, length: 20, width: 10, lengthUnit: 'ft' })).toBe('200 ft²');
    expect(describeCalculatedQuantity('volume', { ...m, length: 5, width: 4, height: 3, lengthUnit: 'm' })).toBe('60 m³');
    expect(describeCalculatedQuantity('time', { ...m, quantity: 8, timeUnit: 'hour' })).toBe('8 hour');
  });
});

describe('PDF unit-price column', () => {
  const config = resolveInvoiceFieldConfig({ invoiceTypeId: 'area', customFieldKeys: [] });
  const unitPriceColumn = getPdfItemColumns(config).find((c) => c.key === 'unitPrice')!;
  const totalColumn = getPdfItemColumns(config).find((c) => c.key === 'total')!;
  const snapshot: InvoiceItemSnapshot = {
    id: 'l1',
    itemId: null,
    itemName: 'Slab',
    description: null,
    sku: null,
    quantity: null,
    unit: null,
    weight: null,
    length: 10,
    width: 10,
    height: null,
    unitPrice: 8,
    discountPercent: null,
    taxPercent: null,
    subtotal: 800,
    discountAmount: 0,
    taxAmount: 0,
    lineTotal: 800,
  };

  it('a unit-priced line prints its unit price', () => {
    expect(unitPriceColumn.render(snapshot, 'USD')).toContain('8');
  });

  it('a total-priced line prints a dash instead of a misleading $0.00, and its total is the entered price', () => {
    const totalLine: InvoiceItemSnapshot = {
      ...snapshot,
      priceMode: 'total',
      unitPrice: 0,
      totalPrice: 900,
      subtotal: 900,
      lineTotal: 900,
    };
    expect(unitPriceColumn.render(totalLine, 'USD')).toBe('—');
    expect(totalColumn.render(totalLine, 'USD')).toContain('900');
  });
});
