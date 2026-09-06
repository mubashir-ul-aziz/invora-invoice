import { businessProfileFormSchema, invoiceSettingsFormSchema } from '../validation';

describe('businessProfileFormSchema', () => {
  const base = {
    businessName: 'Acme Co',
    logoUri: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    currency: 'usd',
    taxId: '',
    invoicePrefix: 'INV-',
    nextInvoiceNumber: '1',
  };

  it('accepts a minimal valid profile and normalizes currency', () => {
    const result = businessProfileFormSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('USD');
      expect(result.data.nextInvoiceNumber).toBe(1);
    }
  });

  it('requires a business name', () => {
    const result = businessProfileFormSchema.safeParse({ ...base, businessName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid currency code', () => {
    const result = businessProfileFormSchema.safeParse({ ...base, currency: 'US' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer next invoice number', () => {
    const result = businessProfileFormSchema.safeParse({ ...base, nextInvoiceNumber: '1.5' });
    expect(result.success).toBe(false);
  });

  it('rejects a next invoice number below 1', () => {
    const result = businessProfileFormSchema.safeParse({ ...base, nextInvoiceNumber: '0' });
    expect(result.success).toBe(false);
  });

  it('defaults an empty invoice prefix to "INV-"', () => {
    const result = businessProfileFormSchema.safeParse({ ...base, invoicePrefix: '  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invoicePrefix).toBe('INV-');
    }
  });

  it('rejects an invalid phone number', () => {
    const result = businessProfileFormSchema.safeParse({ ...base, phone: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = businessProfileFormSchema.safeParse({ ...base, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });
});

describe('invoiceSettingsFormSchema', () => {
  const base = {
    invoicePrefix: 'INV-',
    nextInvoiceNumber: '1',
    currency: 'usd',
    defaultTaxRate: '',
    defaultPaymentTermsDays: null,
    defaultInvoiceTemplate: 'classic' as const,
    invoiceType: 'general' as const,
  };

  it('accepts settings with no default tax rate', () => {
    const result = invoiceSettingsFormSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultTaxRate).toBeNull();
    }
  });

  it('parses a valid tax rate into a number', () => {
    const result = invoiceSettingsFormSchema.safeParse({ ...base, defaultTaxRate: '7.5' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultTaxRate).toBe(7.5);
    }
  });

  it('rejects a tax rate above 100', () => {
    const result = invoiceSettingsFormSchema.safeParse({ ...base, defaultTaxRate: '150' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric tax rate', () => {
    const result = invoiceSettingsFormSchema.safeParse({ ...base, defaultTaxRate: 'abc' });
    expect(result.success).toBe(false);
  });

  it('accepts a null default payment term (no default)', () => {
    const result = invoiceSettingsFormSchema.safeParse({
      ...base,
      defaultPaymentTermsDays: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a numeric default payment term', () => {
    const result = invoiceSettingsFormSchema.safeParse({
      ...base,
      defaultPaymentTermsDays: 30,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invoice type outside the known set', () => {
    const result = invoiceSettingsFormSchema.safeParse({
      ...base,
      invoiceType: 'bogus',
    });
    expect(result.success).toBe(false);
  });

  it('accepts the "custom" invoice type as an entry-point selection', () => {
    const result = invoiceSettingsFormSchema.safeParse({ ...base, invoiceType: 'custom' });
    expect(result.success).toBe(true);
  });
});
