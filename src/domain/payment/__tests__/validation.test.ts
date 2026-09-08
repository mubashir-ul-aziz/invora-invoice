import { paymentFormSchema } from '../validation';

function baseValues(overrides: Partial<Record<string, string>> = {}) {
  return {
    amount: '100',
    paymentDate: '2026-06-05',
    method: 'cash',
    reference: '',
    notes: '',
    ...overrides,
  };
}

describe('paymentFormSchema', () => {
  it('accepts a fully valid payment', () => {
    const result = paymentFormSchema.safeParse(baseValues());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(100);
      expect(result.data.reference).toBeNull();
    }
  });

  it('rejects a zero amount', () => {
    expect(paymentFormSchema.safeParse(baseValues({ amount: '0' })).success).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(paymentFormSchema.safeParse(baseValues({ amount: '-50' })).success).toBe(false);
  });

  it('rejects a non-numeric amount', () => {
    expect(paymentFormSchema.safeParse(baseValues({ amount: 'abc' })).success).toBe(false);
  });

  it('does not cap the amount at any invoice balance — overpayment is allowed', () => {
    const result = paymentFormSchema.safeParse(baseValues({ amount: '999999' }));
    expect(result.success).toBe(true);
  });

  it('rejects a malformed payment date', () => {
    expect(paymentFormSchema.safeParse(baseValues({ paymentDate: 'not-a-date' })).success).toBe(false);
  });

  it('rejects a calendar-invalid payment date', () => {
    expect(paymentFormSchema.safeParse(baseValues({ paymentDate: '2026-02-30' })).success).toBe(false);
  });

  it('rejects an unknown payment method', () => {
    expect(paymentFormSchema.safeParse(baseValues({ method: 'bitcoin' })).success).toBe(false);
  });

  it('accepts every documented payment method', () => {
    for (const method of ['cash', 'bank_transfer', 'card', 'paypal', 'other']) {
      expect(paymentFormSchema.safeParse(baseValues({ method })).success).toBe(true);
    }
  });

  it('normalizes a blank reference/notes to null', () => {
    const result = paymentFormSchema.safeParse(baseValues({ reference: '   ', notes: '' }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reference).toBeNull();
      expect(result.data.notes).toBeNull();
    }
  });
});
