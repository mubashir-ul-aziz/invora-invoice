import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import type { BusinessRepository } from '@/data/business/BusinessRepository';
import { EMPTY_INVOICE_TYPE_SELECTION_INPUT } from '@/domain/invoiceType/types';

import { createInvoiceTypeStore } from '../invoiceTypeStore';

function failingRepository(message: string): BusinessRepository {
  return {
    getProfile: () => Promise.resolve(null),
    saveProfile: () => Promise.reject(new Error(message)),
    getInvoiceSettings: () => Promise.resolve(null),
    saveInvoiceSettings: () => Promise.reject(new Error(message)),
    getInvoiceTypeSelection: () => Promise.reject(new Error(message)),
    saveInvoiceTypeSelection: () => Promise.reject(new Error(message)),
    getCustomUnits: () => Promise.reject(new Error(message)),
    addCustomUnit: () => Promise.reject(new Error(message)),
    reserveNextInvoiceNumber: () => Promise.reject(new Error(message)),
  };
}

describe('invoiceTypeStore', () => {
  it('starts idle and loads a null selection when none was ever saved', async () => {
    const store = createInvoiceTypeStore(new InMemoryBusinessRepository());
    expect(store.getState().status).toBe('idle');

    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().selection).toBeNull();
  });

  it('saves a fixed invoice type selection', async () => {
    const store = createInvoiceTypeStore(new InMemoryBusinessRepository());

    const saved = await store.getState().save({ invoiceTypeId: 'weight', customFieldKeys: [] });

    expect(store.getState().status).toBe('ready');
    expect(store.getState().selection).toEqual(saved);
    expect(saved.invoiceTypeId).toBe('weight');
  });

  it('saves and normalizes a custom field selection', async () => {
    const store = createInvoiceTypeStore(new InMemoryBusinessRepository());

    const saved = await store.getState().save({
      ...EMPTY_INVOICE_TYPE_SELECTION_INPUT,
      invoiceTypeId: 'custom',
      customFieldKeys: ['sku', 'length'],
    });

    expect(saved.invoiceTypeId).toBe('custom');
    expect(saved.customFieldKeys).toEqual(['itemName', 'sku', 'length', 'unitPrice']);
  });

  it('surfaces repository errors from load() without throwing', async () => {
    const store = createInvoiceTypeStore(failingRepository('disk full'));

    await store.getState().load();

    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe('disk full');
  });

  it('surfaces repository errors from save() and rejects the returned promise', async () => {
    const store = createInvoiceTypeStore(failingRepository('disk full'));

    await expect(
      store.getState().save(EMPTY_INVOICE_TYPE_SELECTION_INPUT),
    ).rejects.toThrow('disk full');
    expect(store.getState().status).toBe('error');
  });
});
