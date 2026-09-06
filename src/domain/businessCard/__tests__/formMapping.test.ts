import { cardToFormDefaults, formValuesToInput } from '../formMapping';
import { businessCardFormSchema } from '../validation';
import type { BusinessCard } from '../types';

const fullCard: BusinessCard = {
  id: 'biz_1',
  businessName: 'Acme Co',
  ownerName: 'Jane Doe',
  logoUri: 'file:///logo.png',
  phone: '+15551234567',
  email: 'jane@acme.com',
  website: 'https://acme.com',
  address: '1 Main St',
  currency: 'USD',
  taxId: 'VAT-1',
  shareSlug: 'abc123',
  socialLinks: [
    { platform: 'whatsapp', value: '+15551234567' },
    { platform: 'facebook', value: 'https://facebook.com/acme' },
  ],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('formMapping', () => {
  it('flattens social links onto the form defaults', () => {
    const defaults = cardToFormDefaults(fullCard);
    expect(defaults.whatsapp).toBe('+15551234567');
    expect(defaults.facebook).toBe('https://facebook.com/acme');
    expect(defaults.instagram).toBe('');
    expect(defaults.googleMapsUrl).toBe('');
  });

  it('produces empty defaults for a brand-new (null) card', () => {
    const defaults = cardToFormDefaults(null);
    expect(defaults.businessName).toBe('');
    expect(defaults.currency).toBe('USD');
    expect(defaults.whatsapp).toBe('');
  });

  it('round-trips validated form output back into a repository input with only set social links', () => {
    const parsed = businessCardFormSchema.parse(cardToFormDefaults(fullCard));
    const input = formValuesToInput(parsed);
    expect(input.businessName).toBe('Acme Co');
    expect(input.socialLinks).toEqual([
      { platform: 'whatsapp', value: '+15551234567' },
      { platform: 'facebook', value: 'https://facebook.com/acme' },
    ]);
  });

  it('omits social links that were never filled in', () => {
    const parsed = businessCardFormSchema.parse({
      ...cardToFormDefaults(null),
      businessName: 'Solo Co',
    });
    const input = formValuesToInput(parsed);
    expect(input.socialLinks).toEqual([]);
  });
});
