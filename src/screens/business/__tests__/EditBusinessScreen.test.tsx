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

// Kept as its own describe block (this file only covers validation-rejection
// paths) — see EditBusinessScreen.save.test.tsx for the successful-save
// path. Splitting avoids the two flows sharing a module/render lifecycle
// within one test file (same reasoning as EditBusinessCardScreen's split).
describe('EditBusinessScreen — validation', () => {
  beforeEach(() => {
    mockStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('rejects an empty profile — business name is required', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('save-business')).toBeTruthy());

    fireEvent.press(view.getByTestId('save-business'));

    await waitFor(() => expect(view.getByTestId('field-businessName-error')).toBeTruthy());
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('rejects an invalid next invoice number', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-businessName')).toBeTruthy());

    fireEvent.changeText(view.getByTestId('field-businessName'), 'Acme Co');
    fireEvent.changeText(view.getByTestId('field-nextInvoiceNumber'), '0');
    fireEvent.press(view.getByTestId('save-business'));

    await waitFor(() => expect(view.getByTestId('field-nextInvoiceNumber-error')).toBeTruthy());
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
