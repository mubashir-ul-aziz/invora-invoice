import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { createInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';

let mockStore: ReturnType<typeof createInvoiceTypeStore>;

jest.mock('@/state/invoiceTypeStore', () => {
  const actual = jest.requireActual('@/state/invoiceTypeStore');
  return {
    ...actual,
    useInvoiceTypeStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

import { InvoiceTypeSelectionScreen } from '../InvoiceTypeSelectionScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(
    <InvoiceTypeSelectionScreen navigation={navigation as never} route={{} as never} />,
  );
}

describe('InvoiceTypeSelectionScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('lists all nine pricing methods and defaults "General" as selected', async () => {
    mockStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('invoice-type-card-general')).toBeTruthy());
    expect(view.getByTestId('invoice-type-card-quantity')).toBeTruthy();
    expect(view.getByTestId('invoice-type-card-weight')).toBeTruthy();
    expect(view.getByTestId('invoice-type-card-length')).toBeTruthy();
    expect(view.getByTestId('invoice-type-card-area')).toBeTruthy();
    expect(view.getByTestId('invoice-type-card-volume')).toBeTruthy();
    expect(view.getByTestId('invoice-type-card-time')).toBeTruthy();
    expect(view.getByTestId('invoice-type-card-service')).toBeTruthy();
    expect(view.getByTestId('invoice-type-card-custom')).toBeTruthy();
    expect(
      view.getByTestId('invoice-type-card-general').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('shows the field preview for a fixed type', async () => {
    mockStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('invoice-type-card-volume')).toBeTruthy());
    expect(view.getByText(/Length, Width, Height/)).toBeTruthy();
  });

  it('selecting a fixed type saves it and navigates back', async () => {
    const repo = new InMemoryBusinessRepository();
    mockStore = createInvoiceTypeStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('invoice-type-card-weight')).toBeTruthy());
    fireEvent.press(view.getByTestId('invoice-type-card-weight'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockStore.getState().selection?.invoiceTypeId).toBe('weight');
    await expect(repo.getInvoiceTypeSelection()).resolves.toMatchObject({
      invoiceTypeId: 'weight',
    });
  });

  it('selecting "Custom" navigates to the Custom Invoice Type screen without saving yet', async () => {
    mockStore = createInvoiceTypeStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('invoice-type-card-custom')).toBeTruthy());
    fireEvent.press(view.getByTestId('invoice-type-card-custom'));

    expect(navigation.navigate).toHaveBeenCalledWith('CustomInvoiceType');
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
