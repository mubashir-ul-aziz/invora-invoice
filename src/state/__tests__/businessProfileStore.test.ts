import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import type { BusinessRepository } from '@/data/business/BusinessRepository';
import { EMPTY_BUSINESS_PROFILE_INPUT } from '@/domain/business/types';

import { createBusinessProfileStore } from '../businessProfileStore';

function failingRepository(message: string): BusinessRepository {
  return {
    getProfile: () => Promise.reject(new Error(message)),
    saveProfile: () => Promise.reject(new Error(message)),
    getInvoiceSettings: () => Promise.resolve(null),
    saveInvoiceSettings: () => Promise.reject(new Error(message)),
    getInvoiceTypeSelection: () => Promise.resolve(null),
    saveInvoiceTypeSelection: () => Promise.reject(new Error(message)),
    getCustomUnits: () => Promise.reject(new Error(message)),
    addCustomUnit: () => Promise.reject(new Error(message)),
    reserveNextInvoiceNumber: () => Promise.reject(new Error(message)),
  };
}

describe('businessProfileStore', () => {
  it('starts idle and loads a null profile when none was ever saved', async () => {
    const store = createBusinessProfileStore(new InMemoryBusinessRepository());
    expect(store.getState().status).toBe('idle');

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().profile).toBeNull();
  });

  it('saves a complete profile', async () => {
    const store = createBusinessProfileStore(new InMemoryBusinessRepository());

    const saved = await store.getState().save({
      ...EMPTY_BUSINESS_PROFILE_INPUT,
      businessName: 'Acme Co',
      invoicePrefix: 'ACM-',
      nextInvoiceNumber: 10,
    });

    expect(store.getState().status).toBe('ready');
    expect(store.getState().profile).toEqual(saved);
    expect(saved.invoicePrefix).toBe('ACM-');
  });

  it('surfaces repository errors from load() without throwing', async () => {
    const store = createBusinessProfileStore(failingRepository('disk full'));

    await store.getState().load();

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('disk full');
  });

  it('surfaces repository errors from save() and rejects the returned promise', async () => {
    const store = createBusinessProfileStore(failingRepository('disk full'));

    await expect(
      store.getState().save({ ...EMPTY_BUSINESS_PROFILE_INPUT, businessName: 'Acme Co' }),
    ).rejects.toThrow('disk full');
    expect(store.getState().status).toBe('error');
  });
});
