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

// Split out from EditBusinessScreen.test.tsx — see that file's doc comment.
describe('EditBusinessScreen — contact field validation', () => {
  beforeEach(() => {
    mockProfileStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    mockCardStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('rejects an invalid phone number and an invalid website URL', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-businessName')).toBeTruthy());

    fireEvent.changeText(view.getByTestId('field-businessName'), 'Acme Co');
    fireEvent.changeText(view.getByTestId('field-phone'), '12');
    fireEvent.changeText(view.getByTestId('field-website'), 'not a url');
    fireEvent.press(view.getByTestId('save-business'));

    await waitFor(() => expect(view.getByTestId('field-phone-error')).toBeTruthy());
    expect(view.getByTestId('field-website-error')).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
