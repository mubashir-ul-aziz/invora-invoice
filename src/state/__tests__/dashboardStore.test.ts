import { InMemoryDashboardRepository } from '@/data/dashboard/InMemoryDashboardRepository';
import type { DashboardRepository } from '@/data/dashboard/DashboardRepository';
import { EMPTY_DASHBOARD_SUMMARY } from '@/domain/dashboard/types';
import type { Invoice } from '@/domain/invoice/types';
import type { Payment } from '@/domain/payment/types';

import { createDashboardStore } from '../dashboardStore';

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
    items: [
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
        unitPrice: 1000,
        discountPercent: null,
        taxPercent: null,
        subtotal: 1000,
        discountAmount: 0,
        taxAmount: 0,
        lineTotal: 1000,
      },
    ],
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

function failingRepository(): DashboardRepository {
  return { getInvoiceEntries: () => Promise.reject(new Error('getInvoiceEntries failed')) };
}

describe('dashboardStore', () => {
  it('starts idle, then loads an empty summary', async () => {
    const store = createDashboardStore(new InMemoryDashboardRepository());
    expect(store.getState().status).toBe('idle');

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().summary).toEqual(EMPTY_DASHBOARD_SUMMARY);
  });

  it('loads the brief’s worked example: $1,000 invoice, $300 + $200 payments', async () => {
    const invoices = [makeInvoice({ id: '1' })];
    const payments = [
      makePayment({ id: 'p1', invoiceId: '1', amount: 300 }),
      makePayment({ id: 'p2', invoiceId: '1', amount: 200 }),
    ];
    const store = createDashboardStore(new InMemoryDashboardRepository(invoices, payments));

    await store.getState().load();

    const { summary } = store.getState();
    expect(summary.totalSales).toBe(1000);
    expect(summary.totalPaid).toBe(500);
    expect(summary.totalOutstanding).toBe(500);
    expect(summary.invoiceCount).toBe(1);
    expect(summary.recentInvoices).toHaveLength(1);
    expect(summary.recentInvoices[0].invoiceId).toBe('1');
  });

  it('sets an error state when the repository fails', async () => {
    const store = createDashboardStore(failingRepository());

    await store.getState().load();

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('getInvoiceEntries failed');
  });

  it('reloading after a failure recovers', async () => {
    const store = createDashboardStore(failingRepository());
    await store.getState().load();
    expect(store.getState().status).toBe('error');

    const recoveredStore = createDashboardStore(new InMemoryDashboardRepository());
    await recoveredStore.getState().load();
    expect(recoveredStore.getState().status).toBe('ready');
  });
});
