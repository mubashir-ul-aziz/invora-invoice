import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { createBusinessProfileStore } from '@/state/businessProfileStore';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';

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

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

import { EditBusinessScreen } from '../EditBusinessScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<EditBusinessScreen navigation={navigation as never} route={{} as never} />);
}

describe('EditBusinessScreen — save', () => {
  it('saves a complete, valid profile and navigates back', async () => {
    mockStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-businessName')).toBeTruthy());

    fireEvent.changeText(view.getByTestId('field-businessName'), 'Acme Co');
    fireEvent.changeText(view.getByTestId('field-taxId'), 'VAT123');
    fireEvent.changeText(view.getByTestId('field-invoicePrefix'), 'ACM-');
    fireEvent.changeText(view.getByTestId('field-nextInvoiceNumber'), '5');

    fireEvent.press(view.getByTestId('save-business'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());

    const saved = mockStore.getState().profile;
    expect(saved?.businessName).toBe('Acme Co');
    expect(saved?.taxId).toBe('VAT123');
    expect(saved?.invoicePrefix).toBe('ACM-');
    expect(saved?.nextInvoiceNumber).toBe(5);
  });
});
