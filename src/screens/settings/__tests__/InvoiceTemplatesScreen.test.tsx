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

import { InvoiceTemplatesScreen } from '../InvoiceTemplatesScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<InvoiceTemplatesScreen navigation={navigation as never} route={{} as never} />);
}

describe('InvoiceTemplatesScreen', () => {
  beforeEach(() => {
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('lists all three templates and defaults "Classic" as selected for a never-configured business', async () => {
    mockStore = createInvoiceSettingsStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('template-card-classic')).toBeTruthy());
    expect(view.getByTestId('template-card-modern')).toBeTruthy();
    expect(view.getByTestId('template-card-compact')).toBeTruthy();
    expect(view.getByTestId('template-card-classic').props.accessibilityState.selected).toBe(true);
  });

  it('selecting a template saves it immediately without clobbering other invoice settings', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveInvoiceSettings({
      invoicePrefix: 'ACM-',
      nextInvoiceNumber: 9,
      currency: 'EUR',
      defaultTaxRate: 5,
      defaultPaymentTermsDays: 15,
      defaultInvoiceTemplate: 'classic',
      invoiceType: 'quantity',
    });
    mockStore = createInvoiceSettingsStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('template-card-modern')).toBeTruthy());
    fireEvent.press(view.getByTestId('template-card-modern'));

    await waitFor(() =>
      expect(mockStore.getState().settings?.defaultInvoiceTemplate).toBe('modern'),
    );
    await expect(repo.getInvoiceSettings()).resolves.toMatchObject({
      defaultInvoiceTemplate: 'modern',
      invoicePrefix: 'ACM-',
      currency: 'EUR',
      invoiceType: 'quantity',
    });
  });

  it('"Done" navigates back without requiring a selection change', async () => {
    mockStore = createInvoiceSettingsStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-done')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-done'));

    expect(navigation.goBack).toHaveBeenCalled();
  });
});
