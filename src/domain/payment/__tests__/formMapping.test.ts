import { formValuesToPaymentUpdateInput, paymentToFormDefaults, todayIsoDate } from '../formMapping';
import type { Payment } from '../types';

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay_1',
    invoiceId: 'inv_1',
    invoiceNumber: 'INV-1',
    customerId: 'cust_1',
    customerName: 'Acme Co',
    amount: 300,
    paymentDate: '2026-06-05',
    method: 'cash',
    reference: 'REF-1',
    notes: 'Paid in cash',
    createdAt: '2026-06-05T00:00:00.000Z',
    updatedAt: '2026-06-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('paymentToFormDefaults', () => {
  it('defaults to blank amount, today\'s date, and "cash" when recording a new payment with no remaining balance given', () => {
    const defaults = paymentToFormDefaults(null);
    expect(defaults.amount).toBe('');
    expect(defaults.paymentDate).toBe(todayIsoDate());
    expect(defaults.method).toBe('cash');
    expect(defaults.reference).toBe('');
    expect(defaults.notes).toBe('');
  });

  it('prefills the amount with the remaining balance when recording a new payment', () => {
    const defaults = paymentToFormDefaults(null, 250);
    expect(defaults.amount).toBe('250');
  });

  it('leaves the amount blank when the remaining balance is 0 (nothing left to pay)', () => {
    const defaults = paymentToFormDefaults(null, 0);
    expect(defaults.amount).toBe('');
  });

  it('round-trips an existing payment\'s fields', () => {
    const payment = makePayment();
    const defaults = paymentToFormDefaults(payment);
    expect(defaults).toEqual({
      amount: '300',
      paymentDate: '2026-06-05',
      method: 'cash',
      reference: 'REF-1',
      notes: 'Paid in cash',
    });
  });

  it('shows an existing payment\'s own amount, not the remaining balance', () => {
    const payment = makePayment({ amount: 300 });
    const defaults = paymentToFormDefaults(payment, 999);
    expect(defaults.amount).toBe('300');
  });
});

describe('formValuesToPaymentUpdateInput', () => {
  it('maps validated form output to the update-input shape', () => {
    const input = formValuesToPaymentUpdateInput({
      amount: 200,
      paymentDate: '2026-06-10',
      method: 'card',
      reference: null,
      notes: null,
    });
    expect(input).toEqual({
      amount: 200,
      paymentDate: '2026-06-10',
      method: 'card',
      reference: null,
      notes: null,
    });
  });
});
