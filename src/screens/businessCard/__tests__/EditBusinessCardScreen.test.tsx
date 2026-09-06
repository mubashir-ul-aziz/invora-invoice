import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { createBusinessCardStore } from '@/state/businessCardStore';
import { InMemoryBusinessCardRepository } from '@/data/businessCard/InMemoryBusinessCardRepository';
import type { ShareLinkService } from '@/data/shareLink/ShareLinkService';

const fakeShareLinkService: ShareLinkService = {
  getShareLink: (card) => `invora://card/${card.shareSlug}`,
};

let mockStore: ReturnType<typeof createBusinessCardStore>;

jest.mock('@/state/businessCardStore', () => {
  const actual = jest.requireActual('@/state/businessCardStore');
  return {
    ...actual,
    useBusinessCardStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

import { EditBusinessCardScreen } from '../EditBusinessCardScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<EditBusinessCardScreen navigation={navigation as never} route={{} as never} />);
}

// Kept as its own describe block (this file only covers validation-rejection
// paths) — see EditBusinessCardScreen.save.test.tsx for the successful-save
// path. Splitting avoids the two flows sharing a module/render lifecycle
// within one test file.
describe('EditBusinessCardScreen — validation', () => {
  beforeEach(() => {
    mockStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('rejects an empty profile — business name is required', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('save-business-card')).toBeTruthy());

    fireEvent.press(view.getByTestId('save-business-card'));

    await waitFor(() => expect(view.getByTestId('field-businessName-error')).toBeTruthy());
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone number and an invalid website URL', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-businessName')).toBeTruthy());

    fireEvent.changeText(view.getByTestId('field-businessName'), 'Acme Co');
    fireEvent.changeText(view.getByTestId('field-phone'), '12');
    fireEvent.changeText(view.getByTestId('field-website'), 'not a url');
    fireEvent.press(view.getByTestId('save-business-card'));

    await waitFor(() => expect(view.getByTestId('field-phone-error')).toBeTruthy());
    expect(view.getByTestId('field-website-error')).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
