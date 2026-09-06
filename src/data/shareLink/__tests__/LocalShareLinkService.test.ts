jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `invora://${path}`),
}));

import * as Linking from 'expo-linking';

import { LocalShareLinkService } from '../LocalShareLinkService';
import type { BusinessCard } from '@/domain/businessCard/types';

const card: BusinessCard = {
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

describe('LocalShareLinkService', () => {
  it('builds a share link from the card share slug via expo-linking, without any network call', () => {
    const service = new LocalShareLinkService();
    const link = service.getShareLink(card);
    expect(link).toBe('invora://card/abc123');
    expect(Linking.createURL).toHaveBeenCalledWith('card/abc123');
  });

  it('never hard-codes a production https URL', () => {
    const service = new LocalShareLinkService();
    const link = service.getShareLink(card);
    expect(link).not.toMatch(/^https?:\/\//);
  });
});
