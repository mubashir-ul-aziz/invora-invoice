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

let mockStore: ReturnType<typeof createBusinessProfileStore>;
let mockCardStore: ReturnType<typeof createBusinessCardStore>;

jest.mock('@/state/businessProfileStore', () => {
  const actual = jest.requireActual('@/state/businessProfileStore');
  return {
    ...actual,
    useBusinessProfileStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
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

import { BusinessScreen } from '../BusinessScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<BusinessScreen navigation={navigation as never} route={{} as never} />);
}

// Split out from BusinessScreen.test.tsx — see that file's trailing comment.
describe('BusinessScreen — settings section', () => {
  beforeEach(() => {
    mockStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    mockCardStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    (navigation.navigate as jest.Mock).mockClear();
  });

  it('shows a business settings section below the business name card with links into each settings screen', async () => {
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('business-settings-section')).toBeTruthy());

    fireEvent.press(view.getByTestId('settings-row-profile'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditBusiness');

    fireEvent.press(view.getByTestId('settings-row-invoice'));
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceSettings');

    fireEvent.press(view.getByTestId('settings-row-invoice-type'));
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceTypeSelection');

    fireEvent.press(view.getByTestId('settings-row-card'));
    expect(navigation.navigate).toHaveBeenCalledWith('DigitalCard');
  });
});
