import { calculateInvoiceTotals, calculateLineTotal, sumInvoiceTotals } from '../calculations';

describe('calculateLineTotal', () => {
  it('multiplies quantity by unit price with no discount/tax (defaults to the general/quantity-priced methods)', () => {
    const result = calculateLineTotal({ quantity: 3, unitPrice: 10, discountPercent: null, taxPercent: null });
    expect(result).toEqual({ calculatedQuantity: 3, subtotal: 30, discountAmount: 0, taxAmount: 0, lineTotal: 30 });
  });

  it('treats a null quantity as 1 for a quantity-priced method (field not part of the invoice type)', () => {
    const result = calculateLineTotal({ quantity: null, unitPrice: 25, discountPercent: null, taxPercent: null });
    expect(result.subtotal).toBe(25);
    expect(result.lineTotal).toBe(25);
  });

  it('applies a discount percentage to the subtotal', () => {
    const result = calculateLineTotal({ quantity: 2, unitPrice: 50, discountPercent: 10, taxPercent: null });
    expect(result.subtotal).toBe(100);
    expect(result.discountAmount).toBe(10);
    expect(result.lineTotal).toBe(90);
  });

  it('applies tax to the post-discount (taxable) amount, not the raw subtotal', () => {
    const result = calculateLineTotal({ quantity: 1, unitPrice: 100, discountPercent: 20, taxPercent: 10 });
    // subtotal 100, discount 20 -> taxable 80, tax 8 -> total 88
    expect(result).toEqual({ calculatedQuantity: 1, subtotal: 100, discountAmount: 20, taxAmount: 8, lineTotal: 88 });
  });

  it('rounds to the nearest cent', () => {
    const result = calculateLineTotal({ quantity: 3, unitPrice: 10.005, discountPercent: null, taxPercent: null });
    expect(result.subtotal).toBe(30.02);
  });

  // §30 of the brief — one worked example per pricing method.
  it('GENERAL: 1 × £100 = £100', () => {
    const result = calculateLineTotal({ quantity: 1, unitPrice: 100, discountPercent: null, taxPercent: null }, 'general');
    expect(result.calculatedQuantity).toBe(1);
    expect(result.subtotal).toBe(100);
  });

  it('QUANTITY: 10 × £5 = £50', () => {
    const result = calculateLineTotal({ quantity: 10, unitPrice: 5, discountPercent: null, taxPercent: null }, 'quantity');
    expect(result.calculatedQuantity).toBe(10);
    expect(result.subtotal).toBe(50);
  });

  it('WEIGHT: 25kg × £3/kg = £75 — the weight field drives the calculation, not quantity', () => {
    const result = calculateLineTotal(
      { quantity: null, weight: 25, unitPrice: 3, discountPercent: null, taxPercent: null },
      'weight',
    );
    expect(result.calculatedQuantity).toBe(25);
    expect(result.subtotal).toBe(75);
  });

  it('LENGTH: 15m × £4/m = £60', () => {
    const result = calculateLineTotal(
      { quantity: null, length: 15, unitPrice: 4, discountPercent: null, taxPercent: null },
      'length',
    );
    expect(result.calculatedQuantity).toBe(15);
    expect(result.subtotal).toBe(60);
  });

  it('AREA: 5m × 4m × £25/m² = £500 — length × width, never quantity', () => {
    const result = calculateLineTotal(
      { quantity: null, length: 5, width: 4, unitPrice: 25, discountPercent: null, taxPercent: null },
      'area',
    );
    expect(result.calculatedQuantity).toBe(20);
    expect(result.subtotal).toBe(500);
  });

  it('VOLUME: 2m × 3m × 4m × £50/m³ = £1,200', () => {
    const result = calculateLineTotal(
      { quantity: null, length: 2, width: 3, height: 4, unitPrice: 50, discountPercent: null, taxPercent: null },
      'volume',
    );
    expect(result.calculatedQuantity).toBe(24);
    expect(result.subtotal).toBe(1200);
  });

  it('TIME: 5 hours × £50/hour = £250 — duration is carried in the quantity field', () => {
    const result = calculateLineTotal({ quantity: 5, unitPrice: 50, discountPercent: null, taxPercent: null }, 'time');
    expect(result.calculatedQuantity).toBe(5);
    expect(result.subtotal).toBe(250);
  });

  it('SERVICE: 1 × £1,500 = £1,500', () => {
    const result = calculateLineTotal({ quantity: 1, unitPrice: 1500, discountPercent: null, taxPercent: null }, 'service');
    expect(result.calculatedQuantity).toBe(1);
    expect(result.subtotal).toBe(1500);
  });

  it('an AREA line missing width resolves to zero area, not "1 unit" (never a misleading non-zero preview)', () => {
    const result = calculateLineTotal(
      { quantity: null, length: 5, width: null, unitPrice: 25, discountPercent: null, taxPercent: null },
      'area',
    );
    expect(result.calculatedQuantity).toBe(0);
    expect(result.subtotal).toBe(0);
  });
});

describe('sumInvoiceTotals', () => {
  it('sums an empty list to all zeros', () => {
    expect(sumInvoiceTotals([])).toEqual({ subtotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 });
  });

  it('adds up already-computed line results without recomputing them', () => {
    const lines = [
      { subtotal: 100, discountAmount: 10, taxAmount: 9, lineTotal: 99 },
      { subtotal: 50, discountAmount: 0, taxAmount: 5, lineTotal: 55 },
    ];
    expect(sumInvoiceTotals(lines)).toEqual({
      subtotal: 150,
      discountTotal: 10,
      taxTotal: 14,
      grandTotal: 154,
    });
  });
});

describe('calculateInvoiceTotals', () => {
  it('computes each line then sums them — the live draft-preview entry point', () => {
    const totals = calculateInvoiceTotals([
      { quantity: 2, unitPrice: 10, discountPercent: null, taxPercent: null },
      { quantity: 1, unitPrice: 50, discountPercent: 10, taxPercent: 10 },
    ]);
    // line 1: subtotal 20, total 20. line 2: subtotal 50, discount 5, taxable 45, tax 4.5, total 49.5
    expect(totals).toEqual({ subtotal: 70, discountTotal: 5, taxTotal: 4.5, grandTotal: 69.5 });
  });

  it('applies the invoice pricing method to every line — multiple AREA lines', () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: null, length: 5, width: 4, unitPrice: 25, discountPercent: null, taxPercent: null }, // 20 m² × 25 = 500
        { quantity: null, length: 6, width: 3, unitPrice: 20, discountPercent: null, taxPercent: null }, // 18 m² × 20 = 360
      ],
      'area',
    );
    expect(totals.subtotal).toBe(860);
    expect(totals.grandTotal).toBe(860);
  });
});
