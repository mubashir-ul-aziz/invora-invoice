export type SocialPlatform = 'whatsapp' | 'facebook' | 'instagram' | 'googleMaps';

export interface SocialLink {
  platform: SocialPlatform;
  /**
   * `whatsapp`: phone number (digits, optionally with a leading `+`).
   * `facebook` / `instagram`: profile URL.
   * `googleMaps`: an explicit Maps URL, overriding the one derived from
   * `BusinessCard.address` when present.
   */
  value: string;
}

export interface BusinessCard {
  id: string;
  businessName: string;
  ownerName: string | null;
  /** Local file URI (e.g. from the image picker), or null when no logo is set. */
  logoUri: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  currency: string;
  /** Tax / VAT registration number. */
  taxId: string | null;
  /** Stable random slug this card's share link / QR code is built from. */
  shareSlug: string;
  socialLinks: SocialLink[];
  updatedAt: string;
}

/** Fields the Edit screen collects; everything else is derived/managed by the repository. */
export type BusinessCardInput = {
  businessName: string;
  ownerName: string | null;
  logoUri: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  currency: string;
  taxId: string | null;
  socialLinks: SocialLink[];
};

export const EMPTY_BUSINESS_CARD_INPUT: BusinessCardInput = {
  businessName: '',
  ownerName: null,
  logoUri: null,
  phone: null,
  email: null,
  website: null,
  address: null,
  currency: 'USD',
  taxId: null,
  socialLinks: [],
};

export function socialLinkValue(
  card: Pick<BusinessCard, 'socialLinks'> | null | undefined,
  platform: SocialPlatform,
): string | null {
  return card?.socialLinks.find((link) => link.platform === platform)?.value ?? null;
}
