import { invoiceDetailsFormSchema, invoiceLineFormSchema } from '../validation';

describe('invoiceLineFormSchema', () => {
  const base = {
    itemName: 'Widget',
    description: '',
    sku: '',
    quantity: '2',
    unit: 'pcs',
    weight: '',
    length: '',
    width: '',
    height: '',
    unitPrice: '10',
    discountPercent: '',
    taxPercent: '',
  };

  it('accepts a minimal valid line', () => {
    const result = invoiceLineFormSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(2);
      expect(result.data.unitPrice).toBe(10);
      expect(result.data.discountPercent).toBeNull();
    }
  });

  it('rejects an empty item name', () => {
    const result = invoiceLineFormSchema.safeParse({ ...base, itemName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric unit price', () => {
    const result = invoiceLineFormSchema.safeParse({ ...base, unitPrice: 'free' });
    expect(result.success).toBe(false);
  });

  it('rejects a discount/tax percentage over 100', () => {
    expect(invoiceLineFormSchema.safeParse({ ...base, discountPercent: '150' }).success).toBe(false);
    expect(invoiceLineFormSchema.safeParse({ ...base, taxPercent: '101' }).success).toBe(false);
  });
});

describe('invoiceDetailsFormSchema', () => {
  const base = { issueDate: '2026-06-01', dueDate: '2026-06-15', notes: '', terms: '' };

  it('accepts valid dates', () => {
    expect(invoiceDetailsFormSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a malformed issue date', () => {
    expect(invoiceDetailsFormSchema.safeParse({ ...base, issueDate: '06/01/2026' }).success).toBe(false);
  });

  it('rejects a calendar-invalid date', () => {
    expect(invoiceDetailsFormSchema.safeParse({ ...base, issueDate: '2026-02-30' }).success).toBe(false);
  });

  it('rejects a due date before the issue date', () => {
    const result = invoiceDetailsFormSchema.safeParse({ ...base, dueDate: '2026-05-01' });
    expect(result.success).toBe(false);
  });

  it('allows a blank (null) due date', () => {
    const result = invoiceDetailsFormSchema.safeParse({ ...base, dueDate: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBeNull();
    }
  });
});
