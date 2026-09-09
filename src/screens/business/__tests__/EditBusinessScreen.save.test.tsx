import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { createBusinessProfileStore } from '@/state/businessProfileStore';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { createBusinessCardStore } from '@/state/businessCardStore';
import { InMemoryBusinessCardRepository } from '@/data/businessCard/InMemoryBusinessCardRepository';
import type { ShareLinkService } from '@/data/shareLink/ShareLinkService';

const fakeShareLinkService: ShareLinkService = {
  getShareLink: (card) => `invora://card/${card.shareSlug}`,
};

let mockProfileStore: ReturnType<typeof createBusinessProfileStore>;
let mockCardStore: ReturnType<typeof createBusinessCardStore>;

jest.mock('@/state/businessProfileStore', () => {
  const actual = jest.requireActual('@/state/businessProfileStore');
  return {
    ...actual,
    useBusinessProfileStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockProfileStore as any)(...args),
  };
});

jest.mock('@/state/businessCardStore', () => {
  const actual = jest.requireActual('@/state/businessCardStore');
  return {
    ...actual,
    useBusinessCardStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockCardStore as any)(...args),
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
  it('saves the business profile and the business card in one action, and navigates back', async () => {
    mockProfileStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    mockCardStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-businessName')).toBeTruthy());

    fireEvent.changeText(view.getByTestId('field-businessName'), 'Acme Co');
    fireEvent.changeText(view.getByTestId('field-ownerName'), 'Jane Doe');
    fireEvent.changeText(view.getByTestId('field-phone'), '+1 555 123 4567');
    fireEvent.changeText(view.getByTestId('field-email'), 'jane@acme.com');
    fireEvent.changeText(view.getByTestId('field-website'), 'acme.com');
    fireEvent.changeText(view.getByTestId('field-invoicePrefix'), 'ACM-');
    fireEvent.changeText(view.getByTestId('field-whatsapp'), '+15551234567');

    fireEvent.press(view.getByTestId('save-business'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());

    const savedProfile = mockProfileStore.getState().profile;
    expect(savedProfile?.businessName).toBe('Acme Co');
    expect(savedProfile?.website).toBe('https://acme.com');
    expect(savedProfile?.invoicePrefix).toBe('ACM-');
    // "Next invoice number" is read-only — saving never changes it from
    // the empty-state default (1), since there's no input to type into.
    expect(savedProfile?.nextInvoiceNumber).toBe(1);

    const savedCard = mockCardStore.getState().card;
    expect(savedCard?.businessName).toBe('Acme Co');
    expect(savedCard?.ownerName).toBe('Jane Doe');
    expect(savedCard?.socialLinks).toEqual([{ platform: 'whatsapp', value: '+15551234567' }]);
  });
});
