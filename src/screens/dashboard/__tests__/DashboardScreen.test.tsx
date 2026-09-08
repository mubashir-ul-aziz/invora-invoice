import { render, waitFor, fireEvent, within } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryDashboardRepository } from '@/data/dashboard/InMemoryDashboardRepository';
import type { Invoice } from '@/domain/invoice/types';
import { createDashboardStore } from '@/state/dashboardStore';
import { useInvoiceDraftStore } from '@/state/invoiceDraftStore';
import { createInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';

let mockDashboardStore: ReturnType<typeof createDashboardStore>;
let mockInvoiceTypeStore: ReturnType<typeof createInvoiceTypeStore>;
let mockInvoiceSettingsStore: ReturnType<typeof createInvoiceSettingsStore>;

jest.mock('@/state/dashboardStore', () => {
  const actual = jest.requireActual('@/state/dashboardStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useDashboardStore: (...args: unknown[]) => (mockDashboardStore as any)(...args),
  };
});

jest.mock('@/state/invoiceTypeStore', () => {
  const actual = jest.requireActual('@/state/invoiceTypeStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceTypeStore: (...args: unknown[]) => (mockInvoiceTypeStore as any)(...args),
  };
});

jest.mock('@/state/invoiceSettingsStore', () => {
  const actual = jest.requireActual('@/state/invoiceSettingsStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useInvoiceSettingsStore: (...args: unknown[]) => (mockInvoiceSettingsStore as any)(...args),
  };
});

import { DashboardScreen } from '../DashboardScreen';

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  popToTop: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

function renderScreen() {
  return render(<DashboardScreen navigation={navigation as never} route={{} as never} />);
}

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

describe('DashboardScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.addListener as jest.Mock).mockClear();
    mockInvoiceTypeStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    mockInvoiceSettingsStore = createInvoiceSettingsStore(new InMemoryBusinessRepository());
    useInvoiceDraftStore.getState().reset();
  });

  it('shows the empty summary and an empty-state prompt with no invoices', async () => {
    mockDashboardStore = createDashboardStore(new InMemoryDashboardRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('dashboard-summary')).toBeTruthy());
    expect(within(view.getByTestId('summary-total-sales')).getByText('0.00')).toBeTruthy();
    expect(within(view.getByTestId('summary-invoice-count')).getByText('0')).toBeTruthy();
    expect(view.getByTestId('dashboard-recent-empty')).toBeTruthy();
  });

  it('shows an error state with a retry action', async () => {
    mockDashboardStore = createDashboardStore({
      getInvoiceEntries: () => Promise.reject(new Error('boom')),
    });
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('dashboard-error')).toBeTruthy());
  });

  it('shows the brief’s worked example: $1,000 invoice, $300 + $200 payments', async () => {
    const invoices = [makeInvoice({ id: '1' })];
    const payments = [
      {
        id: 'p1',
        invoiceId: '1',
        invoiceNumber: 'INV-1',
        customerId: 'cust-1',
        customerName: 'Acme Co',
        amount: 300,
        paymentDate: '2026-01-01',
        method: 'cash' as const,
        reference: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'p2',
        invoiceId: '1',
        invoiceNumber: 'INV-1',
        customerId: 'cust-1',
        customerName: 'Acme Co',
        amount: 200,
        paymentDate: '2026-01-01',
        method: 'cash' as const,
        reference: null,
        notes: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    mockDashboardStore = createDashboardStore(new InMemoryDashboardRepository(invoices, payments));
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('dashboard-summary')).toBeTruthy());
    expect(within(view.getByTestId('summary-total-sales')).getByText('1000.00')).toBeTruthy();
    expect(within(view.getByTestId('summary-total-paid')).getByText('500.00')).toBeTruthy();
    expect(within(view.getByTestId('summary-total-outstanding')).getByText('500.00')).toBeTruthy();
    expect(within(view.getByTestId('summary-invoice-count')).getByText('1')).toBeTruthy();
    expect(view.getByTestId('dashboard-recent-invoice-1')).toBeTruthy();
  });

  it('tapping a recent invoice navigates to Invoice Detail', async () => {
    const invoices = [makeInvoice({ id: '1' })];
    mockDashboardStore = createDashboardStore(new InMemoryDashboardRepository(invoices, []));
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('dashboard-recent-invoice-1')).toBeTruthy());
    fireEvent.press(view.getByTestId('dashboard-recent-invoice-1'));

    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceDetail', { invoiceId: '1' });
  });

  it('"Create invoice" seeds the draft and opens the customer picker', async () => {
    mockDashboardStore = createDashboardStore(new InMemoryDashboardRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-create-invoice')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-create-invoice'));

    expect(useInvoiceDraftStore.getState().mode).toBe('create');
    expect(navigation.navigate).toHaveBeenCalledWith('CustomerList', {
      onSelectCustomer: expect.any(Function),
    });
  });

  it('"Add customer" navigates to Create Customer', async () => {
    mockDashboardStore = createDashboardStore(new InMemoryDashboardRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-add-customer')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-add-customer'));

    expect(navigation.navigate).toHaveBeenCalledWith('CreateCustomer');
  });

  it('"Record payment" opens the invoice picker, unscoped to any one customer', async () => {
    mockDashboardStore = createDashboardStore(new InMemoryDashboardRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-record-payment')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-record-payment'));

    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceList', {
      onSelectInvoice: expect.any(Function),
    });
  });

  it('navigates to Invoices, Customers, Business, and Settings', async () => {
    mockDashboardStore = createDashboardStore(new InMemoryDashboardRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-invoices')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-invoices'));
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceList');

    fireEvent.press(view.getByTestId('action-customers'));
    expect(navigation.navigate).toHaveBeenCalledWith('CustomerList');

    fireEvent.press(view.getByTestId('action-business'));
    expect(navigation.navigate).toHaveBeenCalledWith('Business');

    fireEvent.press(view.getByTestId('action-settings'));
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');
  });
});
