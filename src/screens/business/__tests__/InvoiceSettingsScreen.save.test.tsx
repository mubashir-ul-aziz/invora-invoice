import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { createInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';

let mockStore: ReturnType<typeof createInvoiceSettingsStore>;

jest.mock('@/state/invoiceSettingsStore', () => {
  const actual = jest.requireActual('@/state/invoiceSettingsStore');
  return {
    ...actual,
    useInvoiceSettingsStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

import { InvoiceSettingsScreen } from '../InvoiceSettingsScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<InvoiceSettingsScreen navigation={navigation as never} route={{} as never} />);
}

describe('InvoiceSettingsScreen — save', () => {
  it('saves invoice prefix, numbering, tax, payment terms, template and invoice type', async () => {
    mockStore = createInvoiceSettingsStore(new InMemoryBusinessRepository());
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-invoicePrefix')).toBeTruthy());

    fireEvent.changeText(view.getByTestId('field-invoicePrefix'), 'ACM-');
    fireEvent.changeText(view.getByTestId('field-nextInvoiceNumber'), '20');
    fireEvent.changeText(view.getByTestId('field-defaultTaxRate'), '7.5');
    fireEvent.press(view.getByTestId('field-defaultPaymentTermsDays-30'));
    fireEvent.press(view.getByTestId('field-defaultInvoiceTemplate-modern'));
    fireEvent.press(view.getByTestId('field-invoiceType-quantity'));

    fireEvent.press(view.getByTestId('save-invoice-settings'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());

    const saved = mockStore.getState().settings;
    expect(saved?.invoicePrefix).toBe('ACM-');
    expect(saved?.nextInvoiceNumber).toBe(20);
    expect(saved?.defaultTaxRate).toBe(7.5);
    expect(saved?.defaultPaymentTermsDays).toBe(30);
    expect(saved?.defaultInvoiceTemplate).toBe('modern');
    expect(saved?.invoiceType).toBe('quantity');
  });
});
