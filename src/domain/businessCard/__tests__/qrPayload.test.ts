import { EMPTY_BUSINESS_CARD_INPUT, type BusinessCard } from '../types';
import { buildBusinessCardVCard } from '../qrPayload';

function makeCard(overrides: Partial<BusinessCard> = {}): BusinessCard {
  return {
    id: 'biz_1',
    shareSlug: 'abc123',
    updatedAt: new Date(0).toISOString(),
    ...EMPTY_BUSINESS_CARD_INPUT,
    socialLinks: [],
    ...overrides,
  };
}

describe('buildBusinessCardVCard', () => {
  it('encodes the full card — name, org, contact details, address', () => {
    const card = makeCard({
      businessName: 'Acme Co',
      ownerName: 'Jane Doe',
      phone: '+15551234567',
      email: 'jane@acme.com',
      website: 'https://acme.com',
      address: '123 Main St, Springfield',
      taxId: 'VAT-999',
    });

    const vcard = buildBusinessCardVCard(card);

    expect(vcard).toContain('BEGIN:VCARD');
    expect(vcard).toContain('VERSION:3.0');
    expect(vcard).toContain('FN:Jane Doe');
    expect(vcard).toContain('ORG:Acme Co');
    expect(vcard).toContain('TEL;TYPE=WORK,VOICE:+15551234567');
    expect(vcard).toContain('EMAIL;TYPE=WORK:jane@acme.com');
    expect(vcard).toContain('URL:https://acme.com');
    expect(vcard).toContain('ADR;TYPE=WORK:;;123 Main St\\, Springfield;;;;');
    expect(vcard).toContain('NOTE:Tax/VAT: VAT-999');
    expect(vcard).toContain('END:VCARD');
  });

  it('falls back to the business name when there is no owner name', () => {
    const card = makeCard({ businessName: 'Acme Co', ownerName: null });
    expect(buildBusinessCardVCard(card)).toContain('FN:Acme Co');
  });

  it('folds social links into NOTE, omitting anything unset', () => {
    const card = makeCard({
      businessName: 'Acme Co',
      socialLinks: [
        { platform: 'whatsapp', value: '+15551234567' },
        { platform: 'instagram', value: 'https://instagram.com/acme' },
      ],
    });

    const vcard = buildBusinessCardVCard(card);

    expect(vcard).toContain('WhatsApp: +15551234567');
    expect(vcard).toContain('Instagram: https://instagram.com/acme');
    expect(vcard).not.toContain('Facebook:');
    expect(vcard).not.toContain('Maps:');
  });

  it('omits optional fields entirely when unset, and always closes the vCard', () => {
    const card = makeCard({ businessName: 'Acme Co' });
    const vcard = buildBusinessCardVCard(card);

    expect(vcard).not.toContain('TEL');
    expect(vcard).not.toContain('EMAIL');
    expect(vcard).not.toContain('URL:');
    expect(vcard).not.toContain('ADR');
    expect(vcard).not.toContain('NOTE:');
    expect(vcard.split('\n')[0]).toBe('BEGIN:VCARD');
    expect(vcard.split('\n').at(-1)).toBe('END:VCARD');
  });
});
