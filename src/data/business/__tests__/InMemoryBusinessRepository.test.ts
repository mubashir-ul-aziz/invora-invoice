import { InMemoryBusinessRepository } from '../InMemoryBusinessRepository';
import { EMPTY_BUSINESS_PROFILE_INPUT, EMPTY_INVOICE_SETTINGS_INPUT } from '@/domain/business/types';

describe('InMemoryBusinessRepository', () => {
  it('returns null for profile and settings before anything is saved', async () => {
    const repo = new InMemoryBusinessRepository();
    await expect(repo.getProfile()).resolves.toBeNull();
    await expect(repo.getInvoiceSettings()).resolves.toBeNull();
  });

  it('saves and returns a complete business profile', async () => {
    const repo = new InMemoryBusinessRepository();
    const saved = await repo.saveProfile({
      ...EMPTY_BUSINESS_PROFILE_INPUT,
      businessName: 'Acme Co',
      phone: '+15551234567',
      email: 'jane@acme.com',
      website: 'https://acme.com',
      address: '1 Main St',
      taxId: 'VAT123',
      invoicePrefix: 'ACM-',
      nextInvoiceNumber: 42,
    });

    expect(saved.id).toBeTruthy();
    expect(saved.businessName).toBe('Acme Co');
    expect(saved.invoicePrefix).toBe('ACM-');
    expect(saved.nextInvoiceNumber).toBe(42);
    await expect(repo.getProfile()).resolves.toEqual(saved);
  });

  it('keeps the same id across repeated profile saves (update, not create)', async () => {
    const repo = new InMemoryBusinessRepository();
    const first = await repo.saveProfile({ ...EMPTY_BUSINESS_PROFILE_INPUT, businessName: 'Acme' });
    const second = await repo.saveProfile({
      ...EMPTY_BUSINESS_PROFILE_INPUT,
      businessName: 'Acme Ltd',
    });
    expect(second.id).toBe(first.id);
    expect(second.businessName).toBe('Acme Ltd');
  });

  it('saving a profile does not clobber previously saved invoice settings', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveInvoiceSettings({
      ...EMPTY_INVOICE_SETTINGS_INPUT,
      defaultTaxRate: 7.5,
      defaultPaymentTermsDays: 30,
      defaultInvoiceTemplate: 'modern',
      invoiceType: 'quantity',
    });

    await repo.saveProfile({ ...EMPTY_BUSINESS_PROFILE_INPUT, businessName: 'Acme Co' });

    const settings = await repo.getInvoiceSettings();
    expect(settings?.defaultTaxRate).toBe(7.5);
    expect(settings?.defaultPaymentTermsDays).toBe(30);
    expect(settings?.defaultInvoiceTemplate).toBe('modern');
    expect(settings?.invoiceType).toBe('quantity');
  });

  it('saving invoice settings does not clobber previously saved profile fields', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveProfile({
      ...EMPTY_BUSINESS_PROFILE_INPUT,
      businessName: 'Acme Co',
      phone: '+15551234567',
    });

    await repo.saveInvoiceSettings({ ...EMPTY_INVOICE_SETTINGS_INPUT, invoicePrefix: 'A-' });

    const profile = await repo.getProfile();
    expect(profile?.businessName).toBe('Acme Co');
    expect(profile?.phone).toBe('+15551234567');
    expect(profile?.invoicePrefix).toBe('A-');
  });

  it('shares invoicePrefix/nextInvoiceNumber/currency between profile and settings', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveProfile({
      ...EMPTY_BUSINESS_PROFILE_INPUT,
      businessName: 'Acme Co',
      invoicePrefix: 'ACM-',
      nextInvoiceNumber: 5,
      currency: 'EUR',
    });

    const settings = await repo.getInvoiceSettings();
    expect(settings?.invoicePrefix).toBe('ACM-');
    expect(settings?.nextInvoiceNumber).toBe(5);
    expect(settings?.currency).toBe('EUR');

    const updatedSettings = await repo.saveInvoiceSettings({
      ...EMPTY_INVOICE_SETTINGS_INPUT,
      invoicePrefix: 'ACM-',
      nextInvoiceNumber: 6,
      currency: 'EUR',
    });
    expect(updatedSettings.nextInvoiceNumber).toBe(6);

    const profile = await repo.getProfile();
    expect(profile?.nextInvoiceNumber).toBe(6);
  });

  it('reserveNextInvoiceNumber formats and atomically increments the counter', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveProfile({ ...EMPTY_BUSINESS_PROFILE_INPUT, invoicePrefix: 'ACM-', nextInvoiceNumber: 5 });

    const first = await repo.reserveNextInvoiceNumber();
    expect(first).toBe('ACM-5');

    const second = await repo.reserveNextInvoiceNumber();
    expect(second).toBe('ACM-6');

    const profile = await repo.getProfile();
    expect(profile?.nextInvoiceNumber).toBe(7);
  });

  it('reserveNextInvoiceNumber works even before a business profile was ever saved', async () => {
    const repo = new InMemoryBusinessRepository();
    const first = await repo.reserveNextInvoiceNumber();
    expect(first).toBe('INV-1');
  });

  it('reserveNextInvoiceNumber never clobbers other business fields', async () => {
    const repo = new InMemoryBusinessRepository();
    await repo.saveProfile({ ...EMPTY_BUSINESS_PROFILE_INPUT, businessName: 'Acme Co' });

    await repo.reserveNextInvoiceNumber();

    const profile = await repo.getProfile();
    expect(profile?.businessName).toBe('Acme Co');
  });
});
