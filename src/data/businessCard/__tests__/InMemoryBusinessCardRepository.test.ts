import { InMemoryBusinessCardRepository } from '../InMemoryBusinessCardRepository';
import { EMPTY_BUSINESS_CARD_INPUT } from '@/domain/businessCard/types';

describe('InMemoryBusinessCardRepository', () => {
  it('returns null for an empty (never-saved) profile', async () => {
    const repo = new InMemoryBusinessCardRepository();
    await expect(repo.getCard()).resolves.toBeNull();
  });

  it('saves and returns a complete profile', async () => {
    const repo = new InMemoryBusinessCardRepository();
    const saved = await repo.saveCard({
      ...EMPTY_BUSINESS_CARD_INPUT,
      businessName: 'Acme Co',
      ownerName: 'Jane Doe',
      phone: '+15551234567',
      email: 'jane@acme.com',
      website: 'https://acme.com',
      address: '1 Main St',
      logoUri: 'file:///logo.png',
      socialLinks: [
        { platform: 'whatsapp', value: '+15551234567' },
        { platform: 'facebook', value: 'https://facebook.com/acme' },
        { platform: 'instagram', value: 'https://instagram.com/acme' },
        { platform: 'googleMaps', value: 'https://maps.google.com/?q=1' },
      ],
    });

    expect(saved.id).toBeTruthy();
    expect(saved.shareSlug).toBeTruthy();
    await expect(repo.getCard()).resolves.toEqual(saved);
  });

  it('persists a profile with a missing logo', async () => {
    const repo = new InMemoryBusinessCardRepository();
    const saved = await repo.saveCard({ ...EMPTY_BUSINESS_CARD_INPUT, businessName: 'Acme Co' });
    expect(saved.logoUri).toBeNull();
  });

  it('persists a profile with no social links', async () => {
    const repo = new InMemoryBusinessCardRepository();
    const saved = await repo.saveCard({ ...EMPTY_BUSINESS_CARD_INPUT, businessName: 'Acme Co' });
    expect(saved.socialLinks).toEqual([]);
  });

  it('keeps the same id and share slug across repeated saves (update, not create)', async () => {
    const repo = new InMemoryBusinessCardRepository();
    const first = await repo.saveCard({ ...EMPTY_BUSINESS_CARD_INPUT, businessName: 'Acme Co' });
    const second = await repo.saveCard({ ...EMPTY_BUSINESS_CARD_INPUT, businessName: 'Acme Co Ltd' });
    expect(second.id).toBe(first.id);
    expect(second.shareSlug).toBe(first.shareSlug);
    expect(second.businessName).toBe('Acme Co Ltd');
  });
});
