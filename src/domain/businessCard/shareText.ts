import type { BusinessCard } from './types';

/** Plain-text summary used by the native share sheet and as the QR/link caption. */
export function buildShareMessage(card: BusinessCard, shareLink: string): string {
  const lines = [card.businessName || 'Business card'];
  if (card.ownerName) lines.push(card.ownerName);
  if (card.phone) lines.push(`Phone: ${card.phone}`);
  if (card.email) lines.push(`Email: ${card.email}`);
  if (card.website) lines.push(`Website: ${card.website}`);
  if (card.address) lines.push(`Address: ${card.address}`);
  lines.push(shareLink);
  return lines.join('\n');
}
