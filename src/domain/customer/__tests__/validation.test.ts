import { customerFormSchema } from '../validation';

describe('customerFormSchema', () => {
  it('accepts a minimal valid customer (name only)', () => {
    const result = customerFormSchema.safeParse({
      name: 'Acme Co',
      phone: '',
      email: '',
      website: '',
      address: '',
      notes: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: 'Acme Co',
        phone: null,
        email: null,
        website: null,
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
      website: '',
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
      website: '',
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
      website: '',
      address: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid website URL', () => {
    const result = customerFormSchema.safeParse({
      name: 'Acme Co',
      phone: '',
      email: '',
      website: 'not a url',
      address: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('normalizes a bare domain website into a full URL', () => {
    const result = customerFormSchema.safeParse({
      name: 'Acme Co',
      phone: '',
      email: '',
      website: 'acme.test',
      address: '',
      notes: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBe('https://acme.test');
    }
  });

  it('accepts a fully populated customer', () => {
    const result = customerFormSchema.safeParse({
      name: 'Acme Co',
      phone: '+1 555 123 4567',
      email: 'ap@acme.test',
      website: 'https://acme.test',
      address: '1 Main St',
      notes: 'Prefers invoices by email.',
    });
    expect(result.success).toBe(true);
  });
});
