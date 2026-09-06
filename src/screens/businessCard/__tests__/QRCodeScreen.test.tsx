import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

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

jest.mock('react-native-qrcode-svg', () => {
  const { Text } = jest.requireActual('react-native');
  return function MockQRCode(props: { value: string }) {
    return <Text testID="mock-qrcode">{props.value}</Text>;
  };
});

import { QRCodeScreen } from '../QRCodeScreen';

function renderScreen() {
  return render(<QRCodeScreen navigation={{} as never} route={{} as never} />);
}

describe('QRCodeScreen', () => {
  it('prompts to set up the card first when there is no business card yet', async () => {
    mockStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    await mockStore.getState().load();
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('qr-empty')).toBeTruthy());
  });

  it('encodes the card share link — generated locally, no server round-trip', async () => {
    const repo = new InMemoryBusinessCardRepository();
    const saved = await repo.saveCard({ ...EMPTY_BUSINESS_CARD_INPUT, businessName: 'Acme Co' });
    mockStore = createBusinessCardStore(repo, fakeShareLinkService);
    await mockStore.getState().load();

    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('mock-qrcode')).toBeTruthy());
    expect(view.getByTestId('mock-qrcode').props.children).toBe(`invora://card/${saved.shareSlug}`);
    expect(view.getByTestId('qr-link-text').props.children).toBe(`invora://card/${saved.shareSlug}`);
  });
});
