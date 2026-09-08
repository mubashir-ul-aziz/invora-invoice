import type { PaymentInput } from '@/domain/payment/types';

import { InMemoryPaymentRepository } from '../InMemoryPaymentRepository';

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

describe('InMemoryPaymentRepository', () => {
  it('returns an empty list before anything is created', async () => {
    const repo = new InMemoryPaymentRepository();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('creates a payment and returns it with an id and timestamps', async () => {
    const repo = new InMemoryPaymentRepository();
    const created = await repo.create(makeInput());

    expect(created.id).toBeTruthy();
    expect(created.amount).toBe(300);
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();
  });

  it('reads a single payment by id, and null for an unknown id', async () => {
    const repo = new InMemoryPaymentRepository();
    const created = await repo.create(makeInput());

    await expect(repo.getById(created.id)).resolves.toEqual(created);
    await expect(repo.getById('missing')).resolves.toBeNull();
  });

  it('supports the brief\'s worked example: two payments against the same invoice', async () => {
    const repo = new InMemoryPaymentRepository();
    await repo.create(makeInput({ amount: 300, paymentDate: '2026-06-01' }));
    await repo.create(makeInput({ amount: 200, paymentDate: '2026-06-10' }));

    const payments = await repo.listByInvoice('inv_1');
    expect(payments).toHaveLength(2);
    expect(payments.reduce((sum, p) => sum + p.amount, 0)).toBe(500);
  });

  it('listByInvoice only returns payments for that invoice', async () => {
    const repo = new InMemoryPaymentRepository();
    await repo.create(makeInput({ invoiceId: 'inv_1' }));
    await repo.create(makeInput({ invoiceId: 'inv_2' }));

    await expect(repo.listByInvoice('inv_1')).resolves.toHaveLength(1);
    await expect(repo.listByInvoice('inv_2')).resolves.toHaveLength(1);
  });

  it('updates an existing payment, keeping its invoice/customer snapshot and id', async () => {
    const repo = new InMemoryPaymentRepository();
    const created = await repo.create(makeInput({ amount: 300, reference: null }));

    const updated = await repo.update(created.id, {
      amount: 350,
      paymentDate: '2026-06-06',
      method: 'card',
      reference: 'REF-9',
      notes: 'Corrected amount',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.invoiceId).toBe(created.invoiceId);
    expect(updated.invoiceNumber).toBe(created.invoiceNumber);
    expect(updated.customerId).toBe(created.customerId);
    expect(updated.amount).toBe(350);
    expect(updated.method).toBe('card');
    expect(updated.reference).toBe('REF-9');
  });

  it('throws when updating a payment that does not exist', async () => {
    const repo = new InMemoryPaymentRepository();
    await expect(
      repo.update('missing', { amount: 1, paymentDate: '2026-01-01', method: 'cash', reference: null, notes: null }),
    ).rejects.toThrow();
  });

  it('deletes a payment', async () => {
    const repo = new InMemoryPaymentRepository();
    const created = await repo.create(makeInput());

    await repo.delete(created.id);

    await expect(repo.getById(created.id)).resolves.toBeNull();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('deleting an unknown id is a harmless no-op', async () => {
    const repo = new InMemoryPaymentRepository();
    await expect(repo.delete('missing')).resolves.toBeUndefined();
  });

  it('filters by search text (invoice number, customer name, reference)', async () => {
    const repo = new InMemoryPaymentRepository();
    await repo.create(makeInput({ invoiceNumber: 'INV-1', customerName: 'Acme Co', reference: 'PO-42' }));
    await repo.create(makeInput({ invoiceId: 'inv_2', invoiceNumber: 'INV-2', customerName: 'Globex Inc', reference: null }));

    await expect(repo.list({ searchText: 'acme', method: 'all' })).resolves.toHaveLength(1);
    await expect(repo.list({ searchText: 'po-42', method: 'all' })).resolves.toHaveLength(1);
    await expect(repo.list({ searchText: 'inv-2', method: 'all' })).resolves.toHaveLength(1);
    await expect(repo.list({ searchText: 'nothing-matches', method: 'all' })).resolves.toHaveLength(0);
  });

  it('filters by method', async () => {
    const repo = new InMemoryPaymentRepository();
    await repo.create(makeInput({ method: 'cash' }));
    await repo.create(makeInput({ method: 'card' }));

    await expect(repo.list({ searchText: '', method: 'card' })).resolves.toHaveLength(1);
  });

  it('filters by customerId', async () => {
    const repo = new InMemoryPaymentRepository();
    await repo.create(makeInput({ customerId: 'cust_1' }));
    await repo.create(makeInput({ customerId: 'cust_2' }));

    await expect(repo.list({ searchText: '', method: 'all', customerId: 'cust_1' })).resolves.toHaveLength(1);
  });

  it('sorts newest payment date first', async () => {
    const repo = new InMemoryPaymentRepository();
    await repo.create(makeInput({ paymentDate: '2026-01-01' }));
    await repo.create(makeInput({ paymentDate: '2026-06-01' }));

    const payments = await repo.list();
    expect(payments.map((p) => p.paymentDate)).toEqual(['2026-06-01', '2026-01-01']);
  });

  it('starts from a seed array without sharing state with the caller', async () => {
    const seedInput = makeInput();
    const repo = new InMemoryPaymentRepository([
      { id: 's1', createdAt: 'now', updatedAt: 'now', ...seedInput },
    ]);
    const payments = await repo.list();
    expect(payments).toHaveLength(1);
    await repo.delete('s1');
    await expect(repo.list()).resolves.toEqual([]);
  });
});
