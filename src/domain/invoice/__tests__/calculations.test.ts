import { calculateInvoiceTotals, calculateLineTotal, sumInvoiceTotals } from '../calculations';

describe('calculateLineTotal', () => {
  it('multiplies quantity by unit price with no discount/tax', () => {
    const result = calculateLineTotal({ quantity: 3, unitPrice: 10, discountPercent: null, taxPercent: null });
    expect(result).toEqual({ subtotal: 30, discountAmount: 0, taxAmount: 0, lineTotal: 30 });
  });

  it('treats a null quantity as 1 (field not part of the invoice type)', () => {
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
    expect(result).toEqual({ subtotal: 100, discountAmount: 20, taxAmount: 8, lineTotal: 88 });
  });

  it('rounds to the nearest cent', () => {
    const result = calculateLineTotal({ quantity: 3, unitPrice: 10.005, discountPercent: null, taxPercent: null });
    expect(result.subtotal).toBe(30.02);
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
});
