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

// Kept as its own describe block (defaults + validation-rejection only) —
// see InvoiceSettingsScreen.save.test.tsx for the successful-save paths.
// Splitting avoids the flows sharing a module/render lifecycle within one
// test file (same reasoning as EditBusinessCardScreen's split in Phase 1).
describe('InvoiceSettingsScreen — defaults & validation', () => {
  beforeEach(() => {
    mockStore = createInvoiceSettingsStore(new InMemoryBusinessRepository());
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('defaults to the general invoice type and classic template', async () => {
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('field-invoicePrefix')).toBeTruthy());
    expect(view.getByTestId('field-invoiceType-general').props.accessibilityState.selected).toBe(
      true,
    );
    expect(
      view.getByTestId('field-defaultInvoiceTemplate-classic').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      view.getByTestId('field-defaultPaymentTermsDays-null').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('rejects a tax rate above 100', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-defaultTaxRate')).toBeTruthy());

    fireEvent.changeText(view.getByTestId('field-defaultTaxRate'), '150');
    fireEvent.press(view.getByTestId('save-invoice-settings'));

    await waitFor(() => expect(view.getByTestId('field-defaultTaxRate-error')).toBeTruthy());
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
