import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import type { PaymentInput } from '@/domain/payment/types';
import { createPaymentStore } from '@/state/paymentStore';

let mockPaymentStore: ReturnType<typeof createPaymentStore>;

jest.mock('@/state/paymentStore', () => {
  const actual = jest.requireActual('@/state/paymentStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usePaymentStore: (...args: unknown[]) => (mockPaymentStore as any)(...args),
  };
});

import { PaymentHistoryScreen } from '../PaymentHistoryScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

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

function renderScreen() {
  return render(<PaymentHistoryScreen navigation={navigation as never} route={{} as never} />);
}

describe('PaymentHistoryScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
  });

  it('shows an empty-state prompt when no payments exist', async () => {
    mockPaymentStore = createPaymentStore(new InMemoryPaymentRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('payment-history-empty')).toBeTruthy());
  });

  it('lists recorded payments with their invoice, customer, and amount', async () => {
    const repo = new InMemoryPaymentRepository();
    await repo.create(makeInput());
    mockPaymentStore = createPaymentStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('INV-1 · Acme Co')).toBeTruthy());
    expect(view.getByText('300.00')).toBeTruthy();
  });

  it('filters the list by search text', async () => {
    const repo = new InMemoryPaymentRepository();
    await repo.create(makeInput({ invoiceNumber: 'INV-1', customerName: 'Acme Co' }));
    await repo.create(makeInput({ invoiceId: 'inv_2', invoiceNumber: 'INV-2', customerName: 'Globex' }));
    mockPaymentStore = createPaymentStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('INV-1 · Acme Co')).toBeTruthy());
    fireEvent.changeText(view.getByTestId('payment-search'), 'globex');

    await waitFor(() => expect(view.queryByText('INV-1 · Acme Co')).toBeNull());
    expect(view.getByText('INV-2 · Globex')).toBeTruthy();
  });

  it('navigates to Edit Payment when tapping a row', async () => {
    const repo = new InMemoryPaymentRepository();
    const created = await repo.create(makeInput());
    mockPaymentStore = createPaymentStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId(`payment-row-${created.id}`)).toBeTruthy());
    fireEvent.press(view.getByTestId(`payment-row-${created.id}`));
    expect(navigation.navigate).toHaveBeenCalledWith('EditPayment', { paymentId: created.id });
  });
});
