import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { createBusinessProfileStore } from '@/state/businessProfileStore';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { createBusinessCardStore } from '@/state/businessCardStore';
import { InMemoryBusinessCardRepository } from '@/data/businessCard/InMemoryBusinessCardRepository';
import { EMPTY_BUSINESS_PROFILE_INPUT } from '@/domain/business/types';
import type { ShareLinkService } from '@/data/shareLink/ShareLinkService';

const fakeShareLinkService: ShareLinkService = {
  getShareLink: (card) => `invora://card/${card.shareSlug}`,
};

let mockStore: ReturnType<typeof createBusinessProfileStore>;
// This screen also preloads the business card store (see BusinessScreen's
// doc comment) — mocked here purely so it never touches the real SQLite
// repository in tests; nothing in this file asserts on card data.
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

describe('BusinessScreen', () => {
  beforeEach(() => {
    mockCardStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    (navigation.navigate as jest.Mock).mockClear();
  });

  it('shows an empty-state prompt when no business profile has been saved', async () => {
    mockStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('business-empty')).toBeTruthy());
  });

  it('displays saved profile fields, including invoice numbering', async () => {
    const repo = new InMemoryBusinessRepository();
    const saved = await repo.saveProfile({
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
    // The business id is generated, not hardcoded — read it back instead of
    // assuming a literal value.
    expect(view.getByText(saved.businessCode)).toBeTruthy();
    expect(view.getByText(`ACM-${saved.businessCode}-7`)).toBeTruthy();
  });

  it('navigates to business settings and the digital card', async () => {
    mockStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-digital-card')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-digital-card'));
    expect(navigation.navigate).toHaveBeenCalledWith('DigitalCard');

    fireEvent.press(view.getByTestId('action-items'));
    expect(navigation.navigate).toHaveBeenCalledWith('ItemList');

    fireEvent.press(view.getByTestId('action-customers'));
    expect(navigation.navigate).toHaveBeenCalledWith('CustomerList');

    fireEvent.press(view.getByTestId('action-invoices'));
    expect(navigation.navigate).toHaveBeenCalledWith('InvoiceList');

    fireEvent.press(view.getByTestId('action-payments'));
    expect(navigation.navigate).toHaveBeenCalledWith('PaymentHistory');

    fireEvent.press(view.getByTestId('action-dashboard'));
    expect(navigation.navigate).toHaveBeenCalledWith('Dashboard');

    fireEvent.press(view.getByTestId('action-settings'));
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');
  });
});

// See BusinessScreen.settingsSection.test.tsx for the business settings
// section coverage — split into its own file because pairing it with the
// tests above in one file reliably corrupts this screen's third render, a
// pre-existing React 19 + RNTL `act()` environment issue (same cause
// documented on EditBusinessScreen.test.tsx), not a bug in this screen.
