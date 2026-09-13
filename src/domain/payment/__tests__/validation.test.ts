import { paymentFormSchema, paymentFormSchemaWithMinDate } from '../validation';

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

  it('rejects an upcoming (future) payment date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    expect(paymentFormSchema.safeParse(baseValues({ paymentDate: iso })).success).toBe(false);
  });

  it('accepts a payment dated today', () => {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(paymentFormSchema.safeParse(baseValues({ paymentDate: iso })).success).toBe(true);
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

describe('paymentFormSchemaWithMinDate', () => {
  // Dates picked safely in the past (relative to any real test-run clock) so
  // only the min-date bound is under test, never the separate "no future
  // dates" rule already covered above.
  it("rejects a payment date before the invoice's issue date", () => {
    const schema = paymentFormSchemaWithMinDate('2020-09-11');
    const result = schema.safeParse(baseValues({ paymentDate: '2020-09-10' }));
    expect(result.success).toBe(false);
  });

  it("accepts a payment date matching the invoice's issue date", () => {
    const schema = paymentFormSchemaWithMinDate('2020-09-11');
    const result = schema.safeParse(baseValues({ paymentDate: '2020-09-11' }));
    expect(result.success).toBe(true);
  });

  it('accepts a payment date after the issue date', () => {
    const schema = paymentFormSchemaWithMinDate('2020-06-01');
    const result = schema.safeParse(baseValues({ paymentDate: '2020-06-05' }));
    expect(result.success).toBe(true);
  });

  it('applies no lower bound when minDate is null', () => {
    const schema = paymentFormSchemaWithMinDate(null);
    const result = schema.safeParse(baseValues({ paymentDate: '2020-01-01' }));
    expect(result.success).toBe(true);
  });
});
