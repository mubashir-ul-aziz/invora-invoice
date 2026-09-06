import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { createBusinessProfileStore } from '@/state/businessProfileStore';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { EMPTY_BUSINESS_PROFILE_INPUT } from '@/domain/business/types';

let mockStore: ReturnType<typeof createBusinessProfileStore>;

jest.mock('@/state/businessProfileStore', () => {
  const actual = jest.requireActual('@/state/businessProfileStore');
  return {
    ...actual,
    useBusinessProfileStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

import { BusinessScreen } from '../BusinessScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<BusinessScreen navigation={navigation as never} route={{} as never} />);
}

describe('BusinessScreen', () => {
  beforeEach(() => {
    (navigation.navigate as jest.Mock).mockClear();
  });

  it('shows an empty-state prompt when no business profile has been saved', async () => {
    mockStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('business-empty')).toBeTruthy());
  });

  it('displays saved profile fields, including invoice numbering', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveProfile({
      ...EMPTY_BUSINESS_PROFILE_INPUT,
      businessName: 'Acme Co',
      currency: 'EUR',
      invoicePrefix: 'ACM-',
      nextInvoiceNumber: 7,
    });
    mockStore = createBusinessProfileStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByText('Acme Co')).toBeTruthy());
    expect(view.getByText('EUR')).toBeTruthy();
    expect(view.getByText('ACM-7')).toBeTruthy();
  });

  it('navigates to edit business, business settings, and the digital card', async () => {
    mockStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-edit-business')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-edit-business'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditBusiness');

    fireEvent.press(view.getByTestId('action-business-settings'));
    expect(navigation.navigate).toHaveBeenCalledWith('BusinessSettings');

    fireEvent.press(view.getByTestId('action-digital-card'));
    expect(navigation.navigate).toHaveBeenCalledWith('DigitalCard');

    fireEvent.press(view.getByTestId('action-items'));
    expect(navigation.navigate).toHaveBeenCalledWith('ItemList');

    fireEvent.press(view.getByTestId('action-customers'));
    expect(navigation.navigate).toHaveBeenCalledWith('CustomerList');

    fireEvent.press(view.getByTestId('action-invoices'));
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceList');
  });
});
