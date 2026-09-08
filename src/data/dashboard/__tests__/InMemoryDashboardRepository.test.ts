import type { Invoice } from '@/domain/invoice/types';
import type { Payment } from '@/domain/payment/types';

import { InMemoryDashboardRepository } from '../InMemoryDashboardRepository';

function makeInvoice(overrides: Partial<Invoice> & { id: string }): Invoice {
  return {
    invoiceNumber: `INV-${overrides.id}`,
    customerId: 'cust-1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-01-01',
    dueDate: null,
    notes: null,
    terms: null,
    items: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> & { id: string; invoiceId: string }): Payment {
  return {
    invoiceNumber: 'INV-1',
    customerId: 'cust-1',
    customerName: 'Acme Co',
    amount: 0,
    paymentDate: '2026-01-01',
    method: 'cash',
    reference: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const oneLine = (lineTotal: number) => [
  {
    id: 'line-1',
    itemId: null,
    itemName: 'Widget',
    description: null,
    sku: null,
    quantity: 1,
    unit: null,
    weight: null,
    length: null,
    width: null,
    height: null,
    unitPrice: lineTotal,
    discountPercent: null,
    taxPercent: null,
    subtotal: lineTotal,
    discountAmount: 0,
    taxAmount: 0,
    lineTotal,
  },
];

describe('InMemoryDashboardRepository', () => {
  it('returns an empty list with no invoices', async () => {
    const repo = new InMemoryDashboardRepository();
    expect(await repo.getInvoiceEntries()).toEqual([]);
  });

  it('computes each invoice’s grand total from its line items and amount paid from its own payments', async () => {
    const invoices = [makeInvoice({ id: '1', items: oneLine(1000) })];
    const payments = [
      makePayment({ id: 'p1', invoiceId: '1', amount: 300 }),
      makePayment({ id: 'p2', invoiceId: '1', amount: 200 }),
    ];
    const repo = new InMemoryDashboardRepository(invoices, payments);

    const entries = await repo.getInvoiceEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ invoiceId: '1', grandTotal: 1000, amountPaid: 500 });
  });

  it('never mixes another invoice’s payments into this invoice’s amount paid', async () => {
    const invoices = [
      makeInvoice({ id: '1', items: oneLine(100) }),
      makeInvoice({ id: '2', items: oneLine(200) }),
    ];
    const payments = [makePayment({ id: 'p1', invoiceId: '2', amount: 200 })];
    const repo = new InMemoryDashboardRepository(invoices, payments);

    const entries = await repo.getInvoiceEntries();

    const invoiceOne = entries.find((e) => e.invoiceId === '1');
    const invoiceTwo = entries.find((e) => e.invoiceId === '2');
    expect(invoiceOne?.amountPaid).toBe(0);
    expect(invoiceTwo?.amountPaid).toBe(200);
  });

  it('an invoice with no payments has amountPaid 0, not undefined', async () => {
    const invoices = [makeInvoice({ id: '1', items: oneLine(50) })];
    const repo = new InMemoryDashboardRepository(invoices, []);

    const [entry] = await repo.getInvoiceEntries();

    expect(entry.amountPaid).toBe(0);
  });

  it('does not share the seed arrays with the caller', async () => {
    const invoices = [makeInvoice({ id: '1', items: oneLine(50) })];
    const payments: Payment[] = [];
    const repo = new InMemoryDashboardRepository(invoices, payments);

    invoices.push(makeInvoice({ id: '2', items: oneLine(999) }));
    payments.push(makePayment({ id: 'p1', invoiceId: '1', amount: 999 }));

    const entries = await repo.getInvoiceEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].amountPaid).toBe(0);
  });
});
