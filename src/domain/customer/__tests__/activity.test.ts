import { filterActivity, sortActivityChronological, summarizeActivity } from '../activity';
import { EMPTY_CUSTOMER_BALANCE_SUMMARY, type CustomerActivityEntry } from '../types';

function invoice(overrides: Partial<CustomerActivityEntry>): CustomerActivityEntry {
  return {
    id: 'inv1',
    type: 'invoice',
    date: '2026-01-01T00:00:00.000Z',
    title: 'Invoice INV-1',
    amount: 100,
    status: 'unpaid',
    ...overrides,
  };
}

function payment(overrides: Partial<CustomerActivityEntry>): CustomerActivityEntry {
  return {
    id: 'pay1',
    type: 'payment',
    date: '2026-01-02T00:00:00.000Z',
    title: 'Payment via Cash',
    amount: 40,
    status: 'cash',
    ...overrides,
  };
}

describe('summarizeActivity', () => {
  it('returns the empty summary for no entries', () => {
    expect(summarizeActivity([])).toEqual(EMPTY_CUSTOMER_BALANCE_SUMMARY);
  });

  it('sums invoices into totalBilled and invoiceCount', () => {
    const entries = [invoice({ id: 'i1', amount: 100 }), invoice({ id: 'i2', amount: 50 })];
    const summary = summarizeActivity(entries);
    expect(summary.totalBilled).toBe(150);
    expect(summary.invoiceCount).toBe(2);
  });

  it('sums payments into totalPaid', () => {
    const entries = [invoice({ amount: 100 }), payment({ amount: 30 }), payment({ id: 'p2', amount: 20 })];
    const summary = summarizeActivity(entries);
    expect(summary.totalPaid).toBe(50);
  });

  it('computes outstanding as billed minus paid, floored at 0', () => {
    const entries = [invoice({ amount: 100 }), payment({ amount: 30 })];
    expect(summarizeActivity(entries).outstanding).toBe(70);

    const overpaid = [invoice({ amount: 100 }), payment({ amount: 150 })];
    expect(summarizeActivity(overpaid).outstanding).toBe(0);
  });

  it('sums only overdue-status invoices into overdueAmount', () => {
    const entries = [
      invoice({ id: 'i1', amount: 100, status: 'overdue' }),
      invoice({ id: 'i2', amount: 50, status: 'unpaid' }),
    ];
    expect(summarizeActivity(entries).overdueAmount).toBe(100);
  });
});

describe('sortActivityChronological', () => {
  it('orders entries newest first without mutating the input', () => {
    const older = invoice({ id: 'old', date: '2026-01-01T00:00:00.000Z' });
    const newer = payment({ id: 'new', date: '2026-02-01T00:00:00.000Z' });
    const input = [older, newer];

    const sorted = sortActivityChronological(input);
    expect(sorted.map((e) => e.id)).toEqual(['new', 'old']);
    expect(input.map((e) => e.id)).toEqual(['old', 'new']);
  });
});

describe('filterActivity', () => {
  const entries = [invoice({ id: 'i1' }), payment({ id: 'p1' })];

  it('returns everything for "all"', () => {
    expect(filterActivity(entries, { type: 'all' })).toHaveLength(2);
  });

  it('filters to just invoices', () => {
    const result = filterActivity(entries, { type: 'invoice' });
    expect(result.map((e) => e.id)).toEqual(['i1']);
  });

  it('filters to just payments', () => {
    const result = filterActivity(entries, { type: 'payment' });
    expect(result.map((e) => e.id)).toEqual(['p1']);
  });
});
