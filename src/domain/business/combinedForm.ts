import type { z } from 'zod';

import { businessCardFormSchema } from '@/domain/businessCard/validation';
import { EMPTY_BUSINESS_CARD_INPUT, socialLinkValue, type BusinessCard, type BusinessCardInput } from '@/domain/businessCard/types';

import { invoicePrefixField, nextInvoiceNumberField } from './validation';
import { EMPTY_BUSINESS_PROFILE_INPUT, type BusinessProfile, type BusinessProfileInput } from './types';

/**
 * The Business screen and the Digital Business Card screen edit two
 * feature-shaped views over the *same* underlying `business` row (see
 * `domain/business/types.ts`'s file doc comment). This module is the single
 * form the product now wants over both views: one schema, one set of
 * defaults, and two extraction functions (one per repository each field's
 * write goes through) so submitting saves the whole row in one action
 * without either save clobbering the other's columns.
 */
export const businessFormSchema = businessCardFormSchema.extend({
  invoicePrefix: invoicePrefixField,
  nextInvoiceNumber: nextInvoiceNumberField,
});

export type BusinessFormValues = z.input<typeof businessFormSchema>;
export type BusinessFormOutput = z.output<typeof businessFormSchema>;

/** Profile + card (or nothing, for "not saved yet") -> flat form default values. */
export function businessToFormDefaults(profile: BusinessProfile | null, card: BusinessCard | null) {
  const profileInput = profile ?? EMPTY_BUSINESS_PROFILE_INPUT;
  const cardInput = card ?? EMPTY_BUSINESS_CARD_INPUT;
  return {
    businessName: profileInput.businessName || cardInput.businessName,
    ownerName: cardInput.ownerName ?? '',
    logoUri: profileInput.logoUri ?? cardInput.logoUri ?? '',
    phone: profileInput.phone ?? cardInput.phone ?? '',
    email: profileInput.email ?? cardInput.email ?? '',
    website: profileInput.website ?? cardInput.website ?? '',
    address: profileInput.address ?? cardInput.address ?? '',
    currency: profileInput.currency || cardInput.currency || 'USD',
    taxId: profileInput.taxId ?? cardInput.taxId ?? '',
    invoicePrefix: profileInput.invoicePrefix || 'INV-',
    nextInvoiceNumber: String(profileInput.nextInvoiceNumber ?? 1),
    whatsapp: card ? socialLinkValue(card, 'whatsapp') ?? '' : '',
    facebook: card ? socialLinkValue(card, 'facebook') ?? '' : '',
    instagram: card ? socialLinkValue(card, 'instagram') ?? '' : '',
    googleMapsUrl: card ? socialLinkValue(card, 'googleMaps') ?? '' : '',
  };
}

/** Validated flat form output -> the shape `BusinessRepository.saveProfile` expects. */
export function businessFormToProfileInput(values: BusinessFormOutput): BusinessProfileInput {
  return {
    businessName: values.businessName,
    logoUri: values.logoUri,
    address: values.address,
    phone: values.phone,
    email: values.email,
    website: values.website,
    currency: values.currency,
    taxId: values.taxId,
    invoicePrefix: values.invoicePrefix,
    nextInvoiceNumber: values.nextInvoiceNumber,
  };
}

/** Validated flat form output -> the shape `BusinessCardRepository.saveCard` expects. */
export function businessFormToCardInput(values: BusinessFormOutput): BusinessCardInput {
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
