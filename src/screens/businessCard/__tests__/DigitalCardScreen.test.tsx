import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { createBusinessCardStore } from '@/state/businessCardStore';
import { InMemoryBusinessCardRepository } from '@/data/businessCard/InMemoryBusinessCardRepository';
import { createBusinessProfileStore } from '@/state/businessProfileStore';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { EMPTY_BUSINESS_CARD_INPUT } from '@/domain/businessCard/types';
import type { ShareLinkService } from '@/data/shareLink/ShareLinkService';

const fakeShareLinkService: ShareLinkService = {
  getShareLink: (card) => `invora://card/${card.shareSlug}`,
};

let mockStore: ReturnType<typeof createBusinessCardStore>;
// This screen also preloads the business profile store (see
// DigitalCardScreen's doc comment) — mocked here purely so it never touches
// the real SQLite repository in tests; nothing in this file asserts on it.
let mockProfileStore: ReturnType<typeof createBusinessProfileStore>;

jest.mock('@/state/businessCardStore', () => {
  const actual = jest.requireActual('@/state/businessCardStore');
  return {
    ...actual,
    useBusinessCardStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

jest.mock('@/state/businessProfileStore', () => {
  const actual = jest.requireActual('@/state/businessProfileStore');
  return {
    ...actual,
    useBusinessProfileStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockProfileStore as any)(...args),
  };
});

import { DigitalCardScreen } from '../DigitalCardScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<DigitalCardScreen navigation={navigation as never} route={{} as never} />);
}

describe('DigitalCardScreen', () => {
  beforeEach(() => {
    mockProfileStore = createBusinessProfileStore(new InMemoryBusinessRepository());
  });

  it('shows an empty-state prompt when no business card has been saved', async () => {
    mockStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('digital-card-empty')).toBeTruthy());
    expect(view.queryByTestId('action-whatsapp')).toBeNull();
  });

  it('renders contact actions only for fields that are actually set', async () => {
    const repo = new InMemoryBusinessCardRepository();
    await repo.saveCard({
      ...EMPTY_BUSINESS_CARD_INPUT,
      businessName: 'Acme Co',
      phone: '+15551234567',
      socialLinks: [{ platform: 'whatsapp', value: '+15551234567' }],
    });
    mockStore = createBusinessCardStore(repo, fakeShareLinkService);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-whatsapp')).toBeTruthy());
    expect(view.queryByTestId('action-call')).toBeNull();
    expect(view.queryByTestId('action-email')).toBeNull();
    expect(view.queryByTestId('action-website')).toBeNull();
    expect(view.queryByTestId('action-maps')).toBeNull();
  });

  it('navigates to the edit screen', async () => {
    mockStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-edit')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-edit'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditBusinessCard');
  });

  it('navigates to the Business screen', async () => {
    mockStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('action-business')).toBeTruthy());
    fireEvent.press(view.getByTestId('action-business'));
    expect(navigation.navigate).toHaveBeenCalledWith('Business');
  });
});
