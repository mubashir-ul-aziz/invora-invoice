import { overpaidAmount, remainingBalance, summarizeInvoicePayments, sumPayments } from '../calculations';

describe('sumPayments', () => {
  it('sums an empty list to 0', () => {
    expect(sumPayments([])).toBe(0);
  });

  it('sums the worked example from the brief: $300 + $200 = $500', () => {
    expect(sumPayments([{ amount: 300 }, { amount: 200 }])).toBe(500);
  });

  it('rounds to the nearest cent', () => {
    expect(sumPayments([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
  });
});

describe('remainingBalance', () => {
  it('matches the brief\'s worked example: $1,000 invoice, $500 paid -> $500 remaining', () => {
    expect(remainingBalance(1000, 500)).toBe(500);
  });

  it('is 0 when fully paid', () => {
    expect(remainingBalance(1000, 1000)).toBe(0);
  });

  it('never goes negative on overpayment — floored at 0', () => {
    expect(remainingBalance(1000, 1200)).toBe(0);
  });
});

describe('overpaidAmount', () => {
  it('is 0 for a partial or exact payment', () => {
    expect(overpaidAmount(1000, 500)).toBe(0);
    expect(overpaidAmount(1000, 1000)).toBe(0);
  });

  it('surfaces the excess when payments exceed the invoice total', () => {
    expect(overpaidAmount(1000, 1200)).toBe(200);
  });
});

describe('summarizeInvoicePayments', () => {
  it('computes paid/remaining from the invoice example: $1,000 invoice, payments of $300 + $200', () => {
    const summary = summarizeInvoicePayments(1000, [{ amount: 300 }, { amount: 200 }]);
    expect(summary).toEqual({ grandTotal: 1000, amountPaid: 500, remaining: 500, overpaid: 0 });
  });

  it('reflects a fully-paid invoice with 0 remaining and 0 overpaid', () => {
    const summary = summarizeInvoicePayments(500, [{ amount: 500 }]);
    expect(summary).toEqual({ grandTotal: 500, amountPaid: 500, remaining: 0, overpaid: 0 });
  });

  it('reflects an overpaid invoice with 0 remaining and a positive overpaid amount', () => {
    const summary = summarizeInvoicePayments(500, [{ amount: 300 }, { amount: 300 }]);
    expect(summary).toEqual({ grandTotal: 500, amountPaid: 600, remaining: 0, overpaid: 100 });
  });

  it('reflects an unpaid invoice with the full amount remaining', () => {
    const summary = summarizeInvoicePayments(500, []);
    expect(summary).toEqual({ grandTotal: 500, amountPaid: 0, remaining: 500, overpaid: 0 });
  });
});
