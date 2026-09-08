import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import type { PaymentRepository } from '@/data/payment/PaymentRepository';
import type { PaymentInput } from '@/domain/payment/types';

import { createPaymentStore } from '../paymentStore';

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

function failingRepository(): PaymentRepository {
  return {
    list: () => Promise.reject(new Error('list failed')),
    listByInvoice: () => Promise.reject(new Error('listByInvoice failed')),
    getById: () => Promise.reject(new Error('getById failed')),
    create: () => Promise.reject(new Error('create failed')),
    update: () => Promise.reject(new Error('update failed')),
    delete: () => Promise.reject(new Error('delete failed')),
  };
}

describe('paymentStore', () => {
  it('loads an empty list, then ready', async () => {
    const store = createPaymentStore(new InMemoryPaymentRepository());
    expect(store.getState().status).toBe('idle');

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().entries).toEqual([]);
  });

  it('create records a payment and refreshes the list', async () => {
    const store = createPaymentStore(new InMemoryPaymentRepository());

    await store.getState().create(makeInput({ amount: 300 }));

    expect(store.getState().entries).toHaveLength(1);
    expect(store.getState().entries[0].amount).toBe(300);
  });

  it('supports multiple payments against the same invoice — the brief\'s worked example', async () => {
    const store = createPaymentStore(new InMemoryPaymentRepository());

    await store.getState().create(makeInput({ amount: 300 }));
    await store.getState().create(makeInput({ amount: 200 }));

    const payments = await store.getState().listByInvoice('inv_1');
    expect(payments).toHaveLength(2);
    expect(payments.reduce((sum, p) => sum + p.amount, 0)).toBe(500);
  });

  it('supports overpayment — recording more than the invoice total is not rejected', async () => {
    const store = createPaymentStore(new InMemoryPaymentRepository());

    await store.getState().create(makeInput({ amount: 700 }));
    await store.getState().create(makeInput({ amount: 500 }));

    const payments = await store.getState().listByInvoice('inv_1');
    expect(payments.reduce((sum, p) => sum + p.amount, 0)).toBe(1200);
  });

  it('update edits a payment and refreshes the list', async () => {
    const store = createPaymentStore(new InMemoryPaymentRepository());
    const created = await store.getState().create(makeInput({ amount: 300 }));

    await store.getState().update(created.id, {
      amount: 350,
      paymentDate: created.paymentDate,
      method: created.method,
      reference: created.reference,
      notes: created.notes,
    });

    expect(store.getState().entries[0].amount).toBe(350);
  });

  it('remove deletes a payment and refreshes the list', async () => {
    const store = createPaymentStore(new InMemoryPaymentRepository());
    const created = await store.getState().create(makeInput());

    await store.getState().remove(created.id);

    expect(store.getState().entries).toEqual([]);
  });

  it('getById reads a single payment without changing the loaded list', async () => {
    const store = createPaymentStore(new InMemoryPaymentRepository());
    const created = await store.getState().create(makeInput());

    await expect(store.getState().getById(created.id)).resolves.toEqual(created);
    await expect(store.getState().getById('missing')).resolves.toBeNull();
  });

  it('setFilter merges the filter and reloads matching payments', async () => {
    const store = createPaymentStore(new InMemoryPaymentRepository());
    await store.getState().create(makeInput({ method: 'cash' }));
    await store.getState().create(makeInput({ method: 'card' }));

    await store.getState().setFilter({ method: 'card' });

    expect(store.getState().entries).toHaveLength(1);
    expect(store.getState().entries[0].method).toBe('card');
    expect(store.getState().filter.method).toBe('card');
  });

  it('sets an error state when load fails', async () => {
    const store = createPaymentStore(failingRepository());

    await store.getState().load();

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('list failed');
  });
});
