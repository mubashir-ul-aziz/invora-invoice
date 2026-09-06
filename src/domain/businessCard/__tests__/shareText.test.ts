import { buildShareMessage } from '../shareText';
import type { BusinessCard } from '../types';

const baseCard: BusinessCard = {
  id: 'biz_1',
  businessName: 'Acme Co',
  ownerName: null,
  logoUri: null,
  phone: null,
  email: null,
  website: null,
  address: null,
  currency: 'USD',
  taxId: null,
  shareSlug: 'abc123',
  socialLinks: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('buildShareMessage', () => {
  it('includes only the fields that are set, plus the share link', () => {
    const message = buildShareMessage(baseCard, 'invora://card/abc123');
    expect(message).toBe('Acme Co\ninvora://card/abc123');
  });

  it('includes every set field for a complete profile', () => {
    const message = buildShareMessage(
      {
        ...baseCard,
        ownerName: 'Jane Doe',
        phone: '+15551234567',
        email: 'jane@acme.com',
        website: 'https://acme.com',
        address: '1 Main St',
      },
      'invora://card/abc123',
    );
    expect(message).toBe(
      [
        'Acme Co',
        'Jane Doe',
        'Phone: +15551234567',
        'Email: jane@acme.com',
        'Website: https://acme.com',
        'Address: 1 Main St',
        'invora://card/abc123',
      ].join('\n'),
    );
  });
});
