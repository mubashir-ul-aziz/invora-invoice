import type { BusinessCard } from '@/domain/businessCard/types';

/**
 * Resolves the destination a business card's QR code and "share" action
 * point to. Kept as an interface so the local, backend-free implementation
 * used today can be swapped for one backed by a hosted redirect service
 * later without touching any screen or store — see
 * `RemoteShareLinkService` (not yet implemented, API contract documented in
 * IMPLEMENTATION_STATUS.md) for that future path.
 */
export interface ShareLinkService {
  /** Returns the link this card's QR code / share action should use. */
  getShareLink(card: BusinessCard): string;
}
