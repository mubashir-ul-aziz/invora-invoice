import {
  businessCardFormSchema,
  isValidPhone,
  isValidUrl,
  normalizePhoneDigits,
  normalizeUrl,
} from '../validation';
import { EMPTY_BUSINESS_CARD_INPUT } from '../types';
import { cardToFormDefaults } from '../formMapping';

describe('phone validation', () => {
  it('accepts plausible phone numbers in varied formats', () => {
    expect(isValidPhone('+1 (555) 123-4567')).toBe(true);
    expect(isValidPhone('5551234567')).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    expect(isValidPhone('123')).toBe(false); // too short
    expect(isValidPhone('call me maybe')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });

  it('normalizes to digits with an optional leading +', () => {
    expect(normalizePhoneDigits('+1 (555) 123-4567')).toBe('+15551234567');
    expect(normalizePhoneDigits('555.123.4567')).toBe('5551234567');
  });
});

describe('url validation', () => {
  it('accepts URLs with or without an explicit scheme', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('example.com')).toBe(true);
    expect(isValidUrl('www.example.com/path?x=1')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('http://')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false); // only http/https accepted
  });

  it('adds https:// to bare domains', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });
});

describe('businessCardFormSchema — empty profile', () => {
  it('rejects a completely empty profile (business name required)', () => {
    const result = businessCardFormSchema.safeParse(cardToFormDefaults(null));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'businessName')).toBe(true);
    }
  });

  it('accepts a profile with only the required business name', () => {
    const result = businessCardFormSchema.safeParse({
      ...cardToFormDefaults(null),
      businessName: 'Acme Co',
    });
    expect(result.success).toBe(true);
  });
});

describe('businessCardFormSchema — complete profile', () => {
  it('accepts a fully filled-out profile', () => {
    const result = businessCardFormSchema.safeParse({
      businessName: 'Acme Co',
      ownerName: 'Jane Doe',
      logoUri: 'file:///logo.png',
      phone: '+1 555 123 4567',
      email: 'jane@acme.com',
      website: 'https://acme.com',
      address: '1 Main St, Springfield',
      currency: 'usd',
      taxId: 'VAT-12345',
      whatsapp: '+15551234567',
      facebook: 'https://facebook.com/acmeco',
      instagram: 'https://instagram.com/acmeco',
      googleMapsUrl: 'https://maps.google.com/?q=1+Main+St',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('USD'); // normalized to uppercase
    }
  });
});

describe('businessCardFormSchema — missing optional social links', () => {
  it('accepts a profile with no social links at all', () => {
    const result = businessCardFormSchema.safeParse({
      ...EMPTY_BUSINESS_CARD_INPUT,
      businessName: 'Acme Co',
      whatsapp: '',
      facebook: '',
      instagram: '',
      googleMapsUrl: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('businessCardFormSchema — missing logo', () => {
  it('accepts a profile with no logo set', () => {
    const result = businessCardFormSchema.safeParse({
      ...cardToFormDefaults(null),
      businessName: 'Acme Co',
      logoUri: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.logoUri).toBeNull();
    }
  });
});

describe('businessCardFormSchema — invalid fields', () => {
  it('flags an invalid website URL', () => {
    const result = businessCardFormSchema.safeParse({
      ...cardToFormDefaults(null),
      businessName: 'Acme Co',
      website: 'not a url',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'website')).toBe(true);
    }
  });

  it('flags an invalid phone number', () => {
    const result = businessCardFormSchema.safeParse({
      ...cardToFormDefaults(null),
      businessName: 'Acme Co',
      phone: '12',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'phone')).toBe(true);
    }
  });

  it('flags an invalid email address', () => {
    const result = businessCardFormSchema.safeParse({
      ...cardToFormDefaults(null),
      businessName: 'Acme Co',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });
});
