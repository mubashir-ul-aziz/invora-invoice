import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createBusinessProfileStore } from '@/state/businessProfileStore';
import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { EMPTY_BUSINESS_PROFILE_INPUT } from '@/domain/business/types';

let mockStore: ReturnType<typeof createBusinessProfileStore>;

jest.mock('@/state/businessProfileStore', () => {
  const actual = jest.requireActual('@/state/businessProfileStore');
  return {
    ...actual,
    useBusinessProfileStore: (...args: unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStore as any)(...args),
  };
});

import { BusinessScreen } from '../BusinessScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderScreen() {
  return render(<BusinessScreen navigation={navigation as never} route={{} as never} />);
}

describe('BusinessScreen logo', () => {
  it('shows a logo placeholder in the business name card when no logo is set', async () => {
    mockStore = createBusinessProfileStore(new InMemoryBusinessRepository());
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('business-logo-placeholder')).toBeTruthy());
    expect(view.queryByTestId('business-logo-image')).toBeNull();
  });

  it('shows the business logo image in the business name card when a logo is set', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveProfile({
      ...EMPTY_BUSINESS_PROFILE_INPUT,
      businessName: 'Acme Co',
      logoUri: 'file:///logo.png',
    });
    mockStore = createBusinessProfileStore(repo);
    const view = await renderScreen();

    await waitFor(() => expect(view.getByTestId('business-logo-image')).toBeTruthy());
    expect(view.queryByTestId('business-logo-placeholder')).toBeNull();
  });
});
