import { InMemoryBusinessRepository } from '../InMemoryBusinessRepository';
import { EMPTY_BUSINESS_PROFILE_INPUT, EMPTY_INVOICE_SETTINGS_INPUT } from '@/domain/business/types';

describe('InMemoryBusinessRepository — invoice type selection (Phase 3)', () => {
  it('returns null before anything is saved', async () => {
    const repo = new InMemoryBusinessRepository();
    await expect(repo.getInvoiceTypeSelection()).resolves.toBeNull();
  });

  it('saves and returns a fixed invoice type selection with an empty custom field list', async () => {
    const repo = new InMemoryBusinessRepository();
    const saved = await repo.saveInvoiceTypeSelection({
      invoiceTypeId: 'volume',
      customFieldKeys: [],
    });
    expect(saved.invoiceTypeId).toBe('volume');
    expect(saved.customFieldKeys).toEqual([]);
    await expect(repo.getInvoiceTypeSelection()).resolves.toEqual(saved);
  });

  it('saves and normalizes a custom invoice type field selection', async () => {
    const repo = new InMemoryBusinessRepository();
    const saved = await repo.saveInvoiceTypeSelection({
      invoiceTypeId: 'custom',
      customFieldKeys: ['sku', 'itemName', 'tax'],
    });
    expect(saved.invoiceTypeId).toBe('custom');
    // itemName/unitPrice are always-included and get normalized back in.
    expect(saved.customFieldKeys).toEqual(['itemName', 'sku', 'unitPrice', 'tax']);
  });

  it('clears the stored custom field list when switching away from "custom"', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveInvoiceTypeSelection({
      invoiceTypeId: 'custom',
      customFieldKeys: ['sku'],
    });
    const saved = await repo.saveInvoiceTypeSelection({
      invoiceTypeId: 'general',
      customFieldKeys: ['sku'],
    });
    expect(saved.customFieldKeys).toEqual([]);
  });

  it('does not clobber the business profile or invoice settings when saving an invoice type selection', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveProfile({ ...EMPTY_BUSINESS_PROFILE_INPUT, businessName: 'Acme Co' });
    await repo.saveInvoiceSettings({ ...EMPTY_INVOICE_SETTINGS_INPUT, defaultTaxRate: 7.5 });

    await repo.saveInvoiceTypeSelection({ invoiceTypeId: 'weight', customFieldKeys: [] });

    const profile = await repo.getProfile();
    const settings = await repo.getInvoiceSettings();
    expect(profile?.businessName).toBe('Acme Co');
    expect(settings?.defaultTaxRate).toBe(7.5);
    expect(settings?.invoiceType).toBe('weight');
  });

  it('does not clobber a previously saved custom field selection when saving unrelated invoice settings', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveInvoiceTypeSelection({ invoiceTypeId: 'custom', customFieldKeys: ['sku'] });

    await repo.saveInvoiceSettings({ ...EMPTY_INVOICE_SETTINGS_INPUT, invoiceType: 'custom' });

    const selection = await repo.getInvoiceTypeSelection();
    expect(selection?.customFieldKeys).toEqual(['itemName', 'sku', 'unitPrice']);
  });
});
