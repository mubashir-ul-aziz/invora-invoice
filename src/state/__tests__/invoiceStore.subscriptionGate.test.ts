import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import type { InvoiceCreationGate } from '@/data/subscription/EntitlementService';
import { EMPTY_BUSINESS_PROFILE_INPUT } from '@/domain/business/types';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
import { InvoiceLimitError, computeInvoiceUsage, getUsagePeriod } from '@/domain/subscription/invoiceAccess';

import { createInvoiceStore } from '../invoiceStore';

const input: InvoiceInput = {
  customerId: 'cust_1',
  customerName: 'Acme Co',
  invoiceTypeId: 'general',
  issueDate: '2026-06-01',
  dueDate: null,
  notes: null,
  terms: null,
  items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 50 }],
};

async function setup(gate: InvoiceCreationGate | null) {
  const business = new InMemoryBusinessRepository();
  await business.saveProfile({ ...EMPTY_BUSINESS_PROFILE_INPUT, invoicePrefix: 'ACM-', nextInvoiceNumber: 1 });
  const invoices = new InMemoryInvoiceRepository();
  const store = createInvoiceStore(invoices, business, new ZeroPaymentTotalsRepository(), gate);
  return { business, invoices, store };
}

describe('invoiceStore — subscription creation gate', () => {
  it('creates invoices normally and records usage once per saved invoice', async () => {
    const gate = { assertCanCreate: jest.fn().mockResolvedValue(undefined), recordCreated: jest.fn().mockResolvedValue(undefined) };
    const { store, invoices } = await setup(gate);

    await store.getState().create(input);

    expect(gate.assertCanCreate).toHaveBeenCalledTimes(1);
    expect(gate.recordCreated).toHaveBeenCalledTimes(1);
    expect(await invoices.list()).toHaveLength(1);
  });

  it('blocks creation at the limit BEFORE consuming an invoice number, and saves nothing', async () => {
    const usage = computeInvoiceUsage('free', 5, getUsagePeriod(Date.now()));
    const gate = {
      assertCanCreate: jest.fn().mockRejectedValue(new InvoiceLimitError(usage)),
      recordCreated: jest.fn(),
    };
    const { store, invoices, business } = await setup(gate);
    const before = (await business.getProfile())!.nextInvoiceNumber;

    await expect(store.getState().create(input)).rejects.toBeInstanceOf(InvoiceLimitError);

    expect(await invoices.list()).toHaveLength(0);
    expect((await business.getProfile())!.nextInvoiceNumber).toBe(before);
    expect(gate.recordCreated).not.toHaveBeenCalled();
  });

  it('still saves the invoice if the usage counter fails to update', async () => {
    const gate = {
      assertCanCreate: jest.fn().mockResolvedValue(undefined),
      recordCreated: jest.fn().mockRejectedValue(new Error('disk full')),
    };
    const { store, invoices } = await setup(gate);

    await expect(store.getState().create(input)).resolves.toMatchObject({ customerName: 'Acme Co' });
    expect(await invoices.list()).toHaveLength(1);
  });

  it('serializes rapid creates so the limit check cannot be raced', async () => {
    let used = 0;
    const gate = {
      assertCanCreate: jest.fn(async () => {
        await Promise.resolve();
        if (used >= 1) throw new InvoiceLimitError(computeInvoiceUsage('free', used, getUsagePeriod(Date.now())));
      }),
      recordCreated: jest.fn(async () => {
        used += 1;
      }),
    };
    const { store, invoices } = await setup(gate);

    const results = await Promise.allSettled([store.getState().create(input), store.getState().create(input)]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(await invoices.list()).toHaveLength(1);
  });

  it('is unrestricted when no gate is supplied (existing behaviour preserved)', async () => {
    const { store, invoices } = await setup(null);
    await store.getState().create(input);
    await store.getState().create(input);
    expect(await invoices.list()).toHaveLength(2);
  });

  it('does not gate edits', async () => {
    const gate = { assertCanCreate: jest.fn().mockResolvedValue(undefined), recordCreated: jest.fn().mockResolvedValue(undefined) };
    const { store } = await setup(gate);
    const created = await store.getState().create(input);
    gate.assertCanCreate.mockClear();

    await store.getState().update(created.id, { issueDate: '2026-06-02', dueDate: null, notes: null, terms: null, items: input.items });

    expect(gate.assertCanCreate).not.toHaveBeenCalled();
  });
});
