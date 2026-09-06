import type { BusinessCardFormOutput } from './validation';
import type { BusinessCard, BusinessCardInput } from './types';
import { EMPTY_BUSINESS_CARD_INPUT, socialLinkValue } from './types';

/** Card (or nothing, for "create new") -> flat form default values. */
export function cardToFormDefaults(card: BusinessCard | null) {
  const input = card ?? EMPTY_BUSINESS_CARD_INPUT;
  return {
    businessName: input.businessName,
    ownerName: input.ownerName ?? '',
    logoUri: input.logoUri ?? '',
    phone: input.phone ?? '',
    email: input.email ?? '',
    website: input.website ?? '',
    address: input.address ?? '',
    currency: input.currency || 'USD',
    taxId: input.taxId ?? '',
    whatsapp: card ? socialLinkValue(card, 'whatsapp') ?? '' : '',
    facebook: card ? socialLinkValue(card, 'facebook') ?? '' : '',
    instagram: card ? socialLinkValue(card, 'instagram') ?? '' : '',
    googleMapsUrl: card ? socialLinkValue(card, 'googleMaps') ?? '' : '',
  };
}

/** Validated flat form output -> the shape the repository expects. */
export function formValuesToInput(values: BusinessCardFormOutput): BusinessCardInput {
  const socialLinks: BusinessCardInput['socialLinks'] = [];
  if (values.whatsapp) socialLinks.push({ platform: 'whatsapp', value: values.whatsapp });
  if (values.facebook) socialLinks.push({ platform: 'facebook', value: values.facebook });
  if (values.instagram) socialLinks.push({ platform: 'instagram', value: values.instagram });
  if (values.googleMapsUrl) socialLinks.push({ platform: 'googleMaps', value: values.googleMapsUrl });

  return {
    businessName: values.businessName,
    ownerName: values.ownerName,
    logoUri: values.logoUri,
    phone: values.phone,
    email: values.email,
    website: values.website,
    address: values.address,
    currency: values.currency,
    taxId: values.taxId,
    socialLinks,
  };
}
