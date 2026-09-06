import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import type { InvoiceRepository } from '@/data/invoice/InvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EMPTY_BUSINESS_PROFILE_INPUT } from '@/domain/business/types';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';

import { createInvoiceStore } from '../invoiceStore';

function makeInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2099-01-01',
    notes: null,
    terms: null,
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 50 }],
    ...overrides,
  };
}

function failingInvoiceRepository(message: string): InvoiceRepository {
  return {
    list: () => Promise.reject(new Error(message)),
    getById: () => Promise.reject(new Error(message)),
    create: () => Promise.reject(new Error(message)),
    update: () => Promise.reject(new Error(message)),
    delete: () => Promise.reject(new Error(message)),
  };
}

describe('invoiceStore', () => {
  it('starts idle and loads an empty list', async () => {
    const store = createInvoiceStore(
      new InMemoryInvoiceRepository(),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );
    expect(store.getState().status).toBe('idle');

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().entries).toEqual([]);
  });

  it('create reserves an invoice number from the business repository, then creates', async () => {
    const business = new InMemoryBusinessRepository();
    await business.saveProfile({ ...EMPTY_BUSINESS_PROFILE_INPUT, invoicePrefix: 'ACM-', nextInvoiceNumber: 5 });
    const store = createInvoiceStore(new InMemoryInvoiceRepository(), business, new ZeroPaymentTotalsRepository());

    const created = await store.getState().create(makeInput());

    expect(created.invoiceNumber).toBe('ACM-5');
    expect(store.getState().entries).toHaveLength(1);
    expect(store.getState().entries[0].totals.grandTotal).toBe(100);
    expect(store.getState().entries[0].status).toBe('unpaid');

    const profile = await business.getProfile();
    expect(profile?.nextInvoiceNumber).toBe(6);
  });

  it('computes and filters by status using real payment totals', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const store = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());

    await store.getState().create(makeInput({ dueDate: '2020-01-01' })); // overdue (unpaid, past due)
    await store.getState().create(makeInput({ dueDate: '2099-01-01' })); // not yet due -> unpaid

    await store.getState().setFilter({ status: 'overdue' });
    expect(store.getState().entries).toHaveLength(1);
    expect(store.getState().entries[0].status).toBe('overdue');

    await store.getState().setFilter({ status: 'all' });
    expect(store.getState().entries).toHaveLength(2);
  });

  it('getDetail returns null for a missing invoice and the computed shape for an existing one', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const store = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
    const created = await store.getState().create(makeInput());

    await expect(store.getState().getDetail('missing')).resolves.toBeNull();

    const detail = await store.getState().getDetail(created.id);
    expect(detail?.invoice.id).toBe(created.id);
    expect(detail?.amountPaid).toBe(0);
    expect(detail?.totals.grandTotal).toBe(100);
  });

  it('update and remove both reload the list', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const store = createInvoiceStore(invoices, new InMemoryBusinessRepository(), new ZeroPaymentTotalsRepository());
    const created = await store.getState().create(makeInput());

    await store.getState().update(created.id, {
      issueDate: '2026-07-01',
      dueDate: null,
      notes: 'Updated',
      terms: null,
      items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Replacement', unitPrice: 200 }],
    });
    expect(store.getState().entries[0].totals.grandTotal).toBe(200);

    await store.getState().remove(created.id);
    expect(store.getState().entries).toHaveLength(0);
  });

  it('surfaces repository errors from load() without throwing', async () => {
    const store = createInvoiceStore(
      failingInvoiceRepository('disk full'),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );

    await store.getState().load();

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('disk full');
  });

  it('surfaces repository errors from create() and rejects the returned promise', async () => {
    const store = createInvoiceStore(
      failingInvoiceRepository('disk full'),
      new InMemoryBusinessRepository(),
      new ZeroPaymentTotalsRepository(),
    );

    await expect(store.getState().create(makeInput())).rejects.toThrow('disk full');
  });
});
