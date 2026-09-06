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

// The "Custom" invoice type is only an entry point in Phase 2 (the field
// matrix / custom-field builder behind it is Phase 3 scope) — this just
// confirms the selection itself saves. Kept in its own file, same reasoning
// as the other InvoiceSettingsScreen test splits.
describe('InvoiceSettingsScreen — custom invoice type entry point', () => {
  it('allows selecting "Custom" as an entry point without a field-builder yet', async () => {
    mockStore = createInvoiceSettingsStore(new InMemoryBusinessRepository());
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-invoiceType-custom')).toBeTruthy());

    fireEvent.press(view.getByTestId('field-invoiceType-custom'));
    fireEvent.press(view.getByTestId('save-invoice-settings'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(mockStore.getState().settings?.invoiceType).toBe('custom');
  });
});
