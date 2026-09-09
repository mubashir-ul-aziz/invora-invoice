import { socialLinkValue, type BusinessCard } from './types';

/**
 * Escapes the characters vCard 3.0 (RFC 2426) treats specially inside a
 * field value. Order matters: backslashes must be escaped first, or the
 * escapes added for the other characters would themselves get re-escaped.
 */
function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Builds a vCard (RFC 2426) text payload embedding the *entire* business
 * card — not just a link to it. Encoded into the small QR code on the back
 * of `CardPreview`, this lets any phone's camera / QR reader import the full
 * contact (name, org, phone, email, address, website) directly with no
 * network round-trip and no Invora install required; the tax id and social
 * links, which vCard has no dedicated field for, ride along in `NOTE`.
 */
export function buildBusinessCardVCard(card: BusinessCard): string {
  const fullName = card.ownerName?.trim() || card.businessName;
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

  lines.push(`FN:${escapeVCardValue(fullName)}`);
  if (card.businessName) lines.push(`ORG:${escapeVCardValue(card.businessName)}`);
  if (card.phone) lines.push(`TEL;TYPE=WORK,VOICE:${escapeVCardValue(card.phone)}`);
  if (card.email) lines.push(`EMAIL;TYPE=WORK:${escapeVCardValue(card.email)}`);
  if (card.website) lines.push(`URL:${escapeVCardValue(card.website)}`);
  if (card.address) lines.push(`ADR;TYPE=WORK:;;${escapeVCardValue(card.address)};;;;`);

  const noteParts: string[] = [];
  if (card.taxId) noteParts.push(`Tax/VAT: ${card.taxId}`);
  const whatsapp = socialLinkValue(card, 'whatsapp');
  const facebook = socialLinkValue(card, 'facebook');
  const instagram = socialLinkValue(card, 'instagram');
  const googleMaps = socialLinkValue(card, 'googleMaps');
  if (whatsapp) noteParts.push(`WhatsApp: ${whatsapp}`);
  if (facebook) noteParts.push(`Facebook: ${facebook}`);
  if (instagram) noteParts.push(`Instagram: ${instagram}`);
  if (googleMaps) noteParts.push(`Maps: ${googleMaps}`);
  if (noteParts.length > 0) lines.push(`NOTE:${escapeVCardValue(noteParts.join(' | '))}`);

  lines.push('END:VCARD');
  return lines.join('\n');
}
