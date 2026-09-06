import { InMemoryBusinessCardRepository } from '@/data/businessCard/InMemoryBusinessCardRepository';
import type { BusinessCardRepository } from '@/data/businessCard/BusinessCardRepository';
import type { ShareLinkService } from '@/data/shareLink/ShareLinkService';
import { EMPTY_BUSINESS_CARD_INPUT } from '@/domain/businessCard/types';

import { createBusinessCardStore } from '../businessCardStore';

const fakeShareLinkService: ShareLinkService = {
  getShareLink: (card) => `invora://card/${card.shareSlug}`,
};

describe('businessCardStore', () => {
  it('starts idle and loads a null card for an empty profile', async () => {
    const store = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);
    expect(store.getState().status).toBe('idle');

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().card).toBeNull();
    expect(store.getState().getShareLink()).toBeNull();
  });

  it('saves a complete profile and exposes its share link', async () => {
    const store = createBusinessCardStore(new InMemoryBusinessCardRepository(), fakeShareLinkService);

    const saved = await store.getState().save({
      ...EMPTY_BUSINESS_CARD_INPUT,
      businessName: 'Acme Co',
    });

    expect(store.getState().status).toBe('ready');
    expect(store.getState().card).toEqual(saved);
    expect(store.getState().getShareLink()).toBe(`invora://card/${saved.shareSlug}`);
  });

  it('surfaces repository errors from load() without throwing', async () => {
    const failingRepository: BusinessCardRepository = {
      getCard: () => Promise.reject(new Error('disk full')),
      saveCard: () => Promise.reject(new Error('disk full')),
    };
    const store = createBusinessCardStore(failingRepository, fakeShareLinkService);

    await store.getState().load();

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('disk full');
  });

  it('surfaces repository errors from save() and rejects the returned promise', async () => {
    const failingRepository: BusinessCardRepository = {
      getCard: () => Promise.resolve(null),
      saveCard: () => Promise.reject(new Error('disk full')),
    };
    const store = createBusinessCardStore(failingRepository, fakeShareLinkService);

    await expect(
      store.getState().save({ ...EMPTY_BUSINESS_CARD_INPUT, businessName: 'Acme Co' }),
    ).rejects.toThrow('disk full');
    expect(store.getState().status).toBe('error');
  });
});
