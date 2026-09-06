import { customerFormSchema } from '../validation';

describe('customerFormSchema', () => {
  it('accepts a minimal valid customer (name only)', () => {
    const result = customerFormSchema.safeParse({
      name: 'Acme Co',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: 'Acme Co',
        phone: null,
        email: null,
        address: null,
        notes: null,
      });
    }
  });

  it('rejects an empty name', () => {
    const result = customerFormSchema.safeParse({
      name: '  ',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid phone number', () => {
    const result = customerFormSchema.safeParse({
      name: 'Acme Co',
      phone: 'abc',
      email: '',
      address: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email address', () => {
    const result = customerFormSchema.safeParse({
      name: 'Acme Co',
      phone: '',
      email: 'not-an-email',
      address: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a fully populated customer', () => {
    const result = customerFormSchema.safeParse({
      name: 'Acme Co',
      phone: '+1 555 123 4567',
      email: 'ap@acme.test',
      address: '1 Main St',
      notes: 'Prefers invoices by email.',
    });
    expect(result.success).toBe(true);
  });
});
