import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import { PaymentBackedPaymentTotalsRepository } from '@/data/paymentTotals/PaymentBackedPaymentTotalsRepository';
import { ZeroPaymentTotalsRepository } from '@/data/paymentTotals/ZeroPaymentTotalsRepository';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';

import { InvoiceBackedCustomerActivityRepository } from '../InvoiceBackedCustomerActivityRepository';

function makeInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2026-06-15',
    notes: null,
    terms: null,
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 50 }],
    ...overrides,
  };
}

describe('InvoiceBackedCustomerActivityRepository', () => {
  it('returns an empty summary/history for a customer with no invoices or payments', async () => {
    const repo = new InvoiceBackedCustomerActivityRepository(
      new InMemoryInvoiceRepository(),
      new ZeroPaymentTotalsRepository(),
      new InMemoryPaymentRepository(),
    );
    await expect(repo.getSummary('cust_1')).resolves.toEqual(
      expect.objectContaining({ totalBilled: 0, invoiceCount: 0 }),
    );
    await expect(repo.getHistory('cust_1')).resolves.toEqual([]);
  });

  it('summarizes only the given customer’s invoices', async () => {
    const invoices = new InMemoryInvoiceRepository();
    await invoices.create('INV-1', makeInput({ customerId: 'cust_1' }));
    await invoices.create('INV-2', makeInput({ customerId: 'cust_2' }));

    const repo = new InvoiceBackedCustomerActivityRepository(
      invoices,
      new ZeroPaymentTotalsRepository(),
      new InMemoryPaymentRepository(),
    );
    const summary = await repo.getSummary('cust_1');

    expect(summary.totalBilled).toBe(100);
    expect(summary.invoiceCount).toBe(1);
    expect(summary.totalPaid).toBe(0);
    expect(summary.outstanding).toBe(100);
  });

  it('marks an overdue unpaid invoice as overdue in both amount and history status', async () => {
    const invoices = new InMemoryInvoiceRepository();
    await invoices.create('INV-1', makeInput({ dueDate: '2020-01-01' }));

    const repo = new InvoiceBackedCustomerActivityRepository(
      invoices,
      new ZeroPaymentTotalsRepository(),
      new InMemoryPaymentRepository(),
    );
    const summary = await repo.getSummary('cust_1');
    expect(summary.overdueAmount).toBe(100);

    const history = await repo.getHistory('cust_1');
    expect(history[0].status).toBe('overdue');
    expect(history[0].title).toBe('Invoice INV-1');
    expect(history[0].type).toBe('invoice');
  });

  it('getHistory filters by type and stays newest-first (invoice-only)', async () => {
    const invoices = new InMemoryInvoiceRepository();
    await invoices.create('INV-1', makeInput({ issueDate: '2026-01-01' }));
    await invoices.create('INV-2', makeInput({ issueDate: '2026-06-01' }));

    const repo = new InvoiceBackedCustomerActivityRepository(
      invoices,
      new ZeroPaymentTotalsRepository(),
      new InMemoryPaymentRepository(),
    );
    const history = await repo.getHistory('cust_1', { type: 'invoice' });
    expect(history.map((e) => e.title)).toEqual(['Invoice INV-2', 'Invoice INV-1']);

    const payments = await repo.getHistory('cust_1', { type: 'payment' });
    expect(payments).toEqual([]);
  });

  it('folds real payments into the summary/history and reflects partial payment status', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const invoice = await invoices.create('INV-1', makeInput({ dueDate: '2099-01-01' }));
    const paymentRepo = new InMemoryPaymentRepository();
    await paymentRepo.create({
      invoiceId: invoice.id,
      invoiceNumber: 'INV-1',
      customerId: 'cust_1',
      customerName: 'Acme Co',
      amount: 30,
      paymentDate: '2026-06-05',
      method: 'cash',
      reference: null,
      notes: null,
    });

    const repo = new InvoiceBackedCustomerActivityRepository(
      invoices,
      new PaymentBackedPaymentTotalsRepository(paymentRepo),
      paymentRepo,
    );

    const summary = await repo.getSummary('cust_1');
    expect(summary.totalBilled).toBe(100);
    expect(summary.totalPaid).toBe(30);
    expect(summary.outstanding).toBe(70);

    const history = await repo.getHistory('cust_1');
    expect(history).toHaveLength(2);
    const paymentEntry = history.find((e) => e.type === 'payment');
    expect(paymentEntry).toMatchObject({ title: 'Payment for INV-1', amount: 30, status: 'Cash' });

    const paymentOnly = await repo.getHistory('cust_1', { type: 'payment' });
    expect(paymentOnly).toHaveLength(1);

    const invoiceOnly = await repo.getHistory('cust_1', { type: 'invoice' });
    expect(invoiceOnly[0].status).toBe('partial');
  });

  it('does not leak another customer’s payments into this customer’s history', async () => {
    const invoices = new InMemoryInvoiceRepository();
    await invoices.create('INV-1', makeInput({ customerId: 'cust_1' }));
    const otherInvoice = await invoices.create('INV-2', makeInput({ customerId: 'cust_2' }));
    const paymentRepo = new InMemoryPaymentRepository();
    await paymentRepo.create({
      invoiceId: otherInvoice.id,
      invoiceNumber: 'INV-2',
      customerId: 'cust_2',
      customerName: 'Other Co',
      amount: 50,
      paymentDate: '2026-06-05',
      method: 'card',
      reference: null,
      notes: null,
    });

    const repo = new InvoiceBackedCustomerActivityRepository(
      invoices,
      new PaymentBackedPaymentTotalsRepository(paymentRepo),
      paymentRepo,
    );
    const history = await repo.getHistory('cust_1', { type: 'payment' });
    expect(history).toEqual([]);
  });
});
