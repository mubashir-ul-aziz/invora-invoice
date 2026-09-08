import {
  formValuesToProfileInput,
  formValuesToSettingsInput,
  profileToFormDefaults,
  settingsToFormDefaults,
  settingsWithTemplate,
} from '../formMapping';
import type { BusinessProfile, InvoiceSettings } from '../types';

describe('profileToFormDefaults / formValuesToProfileInput', () => {
  it('produces empty-string defaults for a never-saved profile', () => {
    const defaults = profileToFormDefaults(null);
    expect(defaults.businessName).toBe('');
    expect(defaults.currency).toBe('USD');
    expect(defaults.invoicePrefix).toBe('INV-');
    expect(defaults.nextInvoiceNumber).toBe('1');
  });

  it('round-trips a saved profile through form defaults and back', () => {
    const profile: BusinessProfile = {
      id: 'biz_1',
      businessName: 'Acme Co',
      logoUri: 'file:///logo.png',
      address: '1 Main St',
      phone: '+15551234567',
      email: 'jane@acme.com',
      website: 'https://acme.com',
      currency: 'EUR',
      taxId: 'VAT123',
      invoicePrefix: 'ACM-',
      nextInvoiceNumber: 12,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const defaults = profileToFormDefaults(profile);
    expect(defaults.nextInvoiceNumber).toBe('12');

    const input = formValuesToProfileInput({
      businessName: defaults.businessName,
      logoUri: profile.logoUri,
      address: profile.address,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      currency: profile.currency,
      taxId: profile.taxId,
      invoicePrefix: profile.invoicePrefix,
      nextInvoiceNumber: profile.nextInvoiceNumber,
    });

    expect(input).toEqual({
      businessName: 'Acme Co',
      logoUri: 'file:///logo.png',
      address: '1 Main St',
      phone: '+15551234567',
      email: 'jane@acme.com',
      website: 'https://acme.com',
      currency: 'EUR',
      taxId: 'VAT123',
      invoicePrefix: 'ACM-',
      nextInvoiceNumber: 12,
    });
  });
});

describe('settingsToFormDefaults / formValuesToSettingsInput', () => {
  it('produces "No default" style empty values for never-saved settings', () => {
    const defaults = settingsToFormDefaults(null);
    expect(defaults.defaultTaxRate).toBe('');
    expect(defaults.defaultPaymentTermsDays).toBeNull();
    expect(defaults.defaultInvoiceTemplate).toBe('classic');
    expect(defaults.invoiceType).toBe('general');
  });

  it('formats a saved tax rate back into a string for the text field', () => {
    const settings: InvoiceSettings = {
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 3,
      currency: 'USD',
      defaultTaxRate: 7.5,
      defaultPaymentTermsDays: 30,
      defaultInvoiceTemplate: 'modern',
      invoiceType: 'weight',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const defaults = settingsToFormDefaults(settings);
    expect(defaults.defaultTaxRate).toBe('7.5');
    expect(defaults.defaultPaymentTermsDays).toBe(30);
  });

  it('maps validated form output to the repository input shape', () => {
    const input = formValuesToSettingsInput({
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 5,
      currency: 'USD',
      defaultTaxRate: null,
      defaultPaymentTermsDays: null,
      defaultInvoiceTemplate: 'classic',
      invoiceType: 'general',
    });
    expect(input).toEqual({
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 5,
      currency: 'USD',
      defaultTaxRate: null,
      defaultPaymentTermsDays: null,
      defaultInvoiceTemplate: 'classic',
      invoiceType: 'general',
    });
  });
});

describe('settingsWithTemplate', () => {
  it('falls back to the empty-state defaults for a never-saved business, with just the chosen template', () => {
    const input = settingsWithTemplate(null, 'modern');
    expect(input).toEqual({
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 1,
      currency: 'USD',
      defaultTaxRate: null,
      defaultPaymentTermsDays: null,
      defaultInvoiceTemplate: 'modern',
      invoiceType: 'general',
    });
  });

  it('changes only the template, carrying every other saved field through untouched', () => {
    const settings: InvoiceSettings = {
      invoicePrefix: 'ACM-',
      nextInvoiceNumber: 42,
      currency: 'EUR',
      defaultTaxRate: 7.5,
      defaultPaymentTermsDays: 30,
      defaultInvoiceTemplate: 'classic',
      invoiceType: 'weight',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const input = settingsWithTemplate(settings, 'compact');

    expect(input).toEqual({
      invoicePrefix: 'ACM-',
      nextInvoiceNumber: 42,
      currency: 'EUR',
      defaultTaxRate: 7.5,
      defaultPaymentTermsDays: 30,
      defaultInvoiceTemplate: 'compact',
      invoiceType: 'weight',
    });
  });
});
