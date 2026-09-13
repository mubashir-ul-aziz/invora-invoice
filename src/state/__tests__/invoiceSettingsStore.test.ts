import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import type { BusinessRepository } from '@/data/business/BusinessRepository';
import { EMPTY_INVOICE_SETTINGS_INPUT } from '@/domain/business/types';

import { createInvoiceSettingsStore } from '../invoiceSettingsStore';

function failingRepository(message: string): BusinessRepository {
  return {
    getProfile: () => Promise.resolve(null),
    saveProfile: () => Promise.reject(new Error(message)),
    getInvoiceSettings: () => Promise.reject(new Error(message)),
    saveInvoiceSettings: () => Promise.reject(new Error(message)),
    getInvoiceTypeSelection: () => Promise.reject(new Error(message)),
    saveInvoiceTypeSelection: () => Promise.reject(new Error(message)),
    getCustomUnits: () => Promise.reject(new Error(message)),
    addCustomUnit: () => Promise.reject(new Error(message)),
    reserveNextInvoiceNumber: () => Promise.reject(new Error(message)),
  };
}

describe('invoiceSettingsStore', () => {
  it('starts idle and loads null settings when none were ever saved', async () => {
    const store = createInvoiceSettingsStore(new InMemoryBusinessRepository());
    expect(store.getState().status).toBe('idle');

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().settings).toBeNull();
  });

  it('saves complete invoice settings', async () => {
    const store = createInvoiceSettingsStore(new InMemoryBusinessRepository());

    const saved = await store.getState().save({
      ...EMPTY_INVOICE_SETTINGS_INPUT,
      defaultTaxRate: 7.5,
      defaultPaymentTermsDays: 30,
      defaultInvoiceTemplate: 'modern',
      invoiceType: 'quantity',
    });

    expect(store.getState().status).toBe('ready');
    expect(store.getState().settings).toEqual(saved);
    expect(saved.invoiceType).toBe('quantity');
  });

  it('surfaces repository errors from load() without throwing', async () => {
    const store = createInvoiceSettingsStore(failingRepository('disk full'));

    await store.getState().load();

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('disk full');
  });

  it('surfaces repository errors from save() and rejects the returned promise', async () => {
    const store = createInvoiceSettingsStore(failingRepository('disk full'));

    await expect(store.getState().save(EMPTY_INVOICE_SETTINGS_INPUT)).rejects.toThrow(
      'disk full',
    );
    expect(store.getState().status).toBe('error');
  });
});
