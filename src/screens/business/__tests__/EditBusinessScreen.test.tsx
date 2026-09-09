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

// Kept as its own describe block (this file only covers the business-profile
// half of validation) — see EditBusinessScreen.socialValidation.test.tsx for
// the digital-card half, and EditBusinessScreen.save.test.tsx for the
// successful-save path. "Next invoice number" has no validation case here
// any more — it's a read-only display now (see EditBusinessScreen.tsx),
// never a user-editable field, so there's nothing to reject.
describe('EditBusinessScreen — validation', () => {
  beforeEach(() => {
    mockProfileStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    mockCardStore = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    (navigation.goBack as jest.Mock).mockClear();
  });

  it('rejects an empty profile — business name is required', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('save-business')).toBeTruthy());

    fireEvent.press(view.getByTestId('save-business'));

    await waitFor(() => expect(view.getByTestId('field-businessName-error')).toBeTruthy());
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('shows the next invoice number as a read-only display, not an editable field', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByTestId('field-nextInvoiceNumber')).toBeTruthy());

    const field = view.getByTestId('field-nextInvoiceNumber');
    expect(field.props.onChangeText).toBeUndefined();
  });
});
