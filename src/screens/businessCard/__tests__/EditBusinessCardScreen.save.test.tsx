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

describe('EditBusinessCardScreen — save', () => {
  it('saves a complete, valid profile and navigates back', async () => {
    mockStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-businessName')).toBeTruthy());

    fireEvent.changeText(view.getByTestId('field-businessName'), 'Acme Co');
    fireEvent.changeText(view.getByTestId('field-phone'), '+1 555 123 4567');
    fireEvent.changeText(view.getByTestId('field-email'), 'jane@acme.com');
    fireEvent.changeText(view.getByTestId('field-website'), 'acme.com');
    fireEvent.changeText(view.getByTestId('field-whatsapp'), '+15551234567');

    fireEvent.press(view.getByTestId('save-business-card'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());

    const saved = mockStore.getState().card;
    expect(saved?.businessName).toBe('Acme Co');
    expect(saved?.website).toBe('https://acme.com');
    expect(saved?.socialLinks).toEqual([{ platform: 'whatsapp', value: '+15551234567' }]);
  });
});
