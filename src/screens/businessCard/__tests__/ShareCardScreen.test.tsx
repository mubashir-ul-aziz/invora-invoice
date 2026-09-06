import { render, waitFor, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Share } from 'react-native';

import { createBusinessCardStore } from '@/state/businessCardStore';
import { InMemoryBusinessCardRepository } from '@/data/businessCard/InMemoryBusinessCardRepository';
import { EMPTY_BUSINESS_CARD_INPUT } from '@/domain/businessCard/types';
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

import { ShareCardScreen } from '../ShareCardScreen';

function renderScreen() {
  return render(<ShareCardScreen navigation={{} as never} route={{} as never} />);
}

describe('ShareCardScreen', () => {
  it('shows an empty-state prompt when there is no business card yet', async () => {
    mockStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('share-empty')).toBeTruthy());
  });

  it('invokes the native share sheet with the card summary and share link', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);

    const repo = new InMemoryBusinessCardRepository();
    const saved = await repo.saveCard({
      ...EMPTY_BUSINESS_CARD_INPUT,
      businessName: 'Acme Co',
      phone: '+15551234567',
    });
    mockStore = createBusinessCardStore(repo, fakeShareLinkService);
    await mockStore.getState().load();

    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('share-button')).toBeTruthy());
    fireEvent.press(view.getByTestId('share-button'));

    await waitFor(() =>
      expect(Share.share).toHaveBeenCalledWith({
        message: `Acme Co\nPhone: +15551234567\ninvora://card/${saved.shareSlug}`,
        title: 'Acme Co',
      }),
    );
  });
});
