import type { Payment } from '../types';
import { paymentMatchesFilter, sortPayments } from '../filtering';

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay_1',
    invoiceId: 'inv_1',
    invoiceNumber: 'INV-1',
    customerId: 'cust_1',
    customerName: 'Acme Co',
    amount: 100,
    paymentDate: '2026-06-05',
    method: 'cash',
    reference: 'PO-42',
    notes: null,
    createdAt: '2026-06-05T00:00:00.000Z',
    updatedAt: '2026-06-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('paymentMatchesFilter', () => {
  it('matches everything with an empty filter', () => {
    expect(paymentMatchesFilter(makePayment(), { searchText: '', method: 'all' })).toBe(true);
  });

  it('matches by invoice number, case-insensitively', () => {
    expect(paymentMatchesFilter(makePayment(), { searchText: 'inv-1', method: 'all' })).toBe(true);
    expect(paymentMatchesFilter(makePayment(), { searchText: 'inv-2', method: 'all' })).toBe(false);
  });

  it('matches by customer name', () => {
    expect(paymentMatchesFilter(makePayment(), { searchText: 'acme', method: 'all' })).toBe(true);
  });

  it('matches by reference', () => {
    expect(paymentMatchesFilter(makePayment(), { searchText: 'po-42', method: 'all' })).toBe(true);
    expect(paymentMatchesFilter(makePayment({ reference: null }), { searchText: 'po-42', method: 'all' })).toBe(false);
  });

  it('filters by method', () => {
    const payment = makePayment({ method: 'card' });
    expect(paymentMatchesFilter(payment, { searchText: '', method: 'card' })).toBe(true);
    expect(paymentMatchesFilter(payment, { searchText: '', method: 'cash' })).toBe(false);
  });

  it('filters by customerId when given', () => {
    const payment = makePayment({ customerId: 'cust_9' });
    expect(paymentMatchesFilter(payment, { searchText: '', method: 'all', customerId: 'cust_9' })).toBe(true);
    expect(paymentMatchesFilter(payment, { searchText: '', method: 'all', customerId: 'cust_1' })).toBe(false);
  });

  it('filters by invoiceId when given', () => {
    const payment = makePayment({ invoiceId: 'inv_9' });
    expect(paymentMatchesFilter(payment, { searchText: '', method: 'all', invoiceId: 'inv_9' })).toBe(true);
    expect(paymentMatchesFilter(payment, { searchText: '', method: 'all', invoiceId: 'inv_1' })).toBe(false);
  });
});

describe('sortPayments', () => {
  it('sorts newest payment date first, without mutating the input', () => {
    const older = makePayment({ id: 'a', paymentDate: '2026-01-01' });
    const newer = makePayment({ id: 'b', paymentDate: '2026-06-01' });
    const input = [older, newer];
    const sorted = sortPayments(input);
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
    expect(input).toEqual([older, newer]);
  });

  it('breaks a same-date tie by newest-created first', () => {
    const first = makePayment({ id: 'a', paymentDate: '2026-06-01', createdAt: '2026-06-01T09:00:00.000Z' });
    const second = makePayment({ id: 'b', paymentDate: '2026-06-01', createdAt: '2026-06-01T10:00:00.000Z' });
    expect(sortPayments([first, second]).map((p) => p.id)).toEqual(['b', 'a']);
  });
});
