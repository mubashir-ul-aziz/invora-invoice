import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import type { PaymentInput } from '@/domain/payment/types';

import { PaymentBackedPaymentTotalsRepository } from '../PaymentBackedPaymentTotalsRepository';

function makeInput(overrides: Partial<PaymentInput> = {}): PaymentInput {
  return {
    invoiceId: 'inv_1',
    invoiceNumber: 'INV-1',
    customerId: 'cust_1',
    customerName: 'Acme Co',
    amount: 300,
    paymentDate: '2026-06-05',
    method: 'cash',
    reference: null,
    notes: null,
    ...overrides,
  };
}

describe('PaymentBackedPaymentTotalsRepository', () => {
  it('reports 0 for an invoice with no payments', async () => {
    const repo = new PaymentBackedPaymentTotalsRepository(new InMemoryPaymentRepository());
    await expect(repo.getTotalPaid('inv_1')).resolves.toBe(0);
  });

  it('sums multiple payments against the same invoice — the brief\'s worked example', async () => {
    const payments = new InMemoryPaymentRepository();
    await payments.create(makeInput({ amount: 300 }));
    await payments.create(makeInput({ amount: 200 }));

    const repo = new PaymentBackedPaymentTotalsRepository(payments);
    await expect(repo.getTotalPaid('inv_1')).resolves.toBe(500);
  });

  it('never mixes payments from a different invoice into the total', async () => {
    const payments = new InMemoryPaymentRepository();
    await payments.create(makeInput({ invoiceId: 'inv_1', amount: 100 }));
    await payments.create(makeInput({ invoiceId: 'inv_2', amount: 999 }));

    const repo = new PaymentBackedPaymentTotalsRepository(payments);
    await expect(repo.getTotalPaid('inv_1')).resolves.toBe(100);
  });

  it('computes a batch of totals in one call, defaulting untouched invoices to 0', async () => {
    const payments = new InMemoryPaymentRepository();
    await payments.create(makeInput({ invoiceId: 'inv_1', amount: 300 }));
    await payments.create(makeInput({ invoiceId: 'inv_1', amount: 200 }));
    await payments.create(makeInput({ invoiceId: 'inv_2', amount: 50 }));

    const repo = new PaymentBackedPaymentTotalsRepository(payments);
    await expect(repo.getTotalPaidForInvoices(['inv_1', 'inv_2', 'inv_3'])).resolves.toEqual({
      inv_1: 500,
      inv_2: 50,
      inv_3: 0,
    });
  });

  it('returns an empty map for an empty batch', async () => {
    const repo = new PaymentBackedPaymentTotalsRepository(new InMemoryPaymentRepository());
    await expect(repo.getTotalPaidForInvoices([])).resolves.toEqual({});
  });
});
