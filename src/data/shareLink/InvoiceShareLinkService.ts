import type { Invoice } from '@/domain/invoice/types';

/**
 * The invoice-PDF/Sharing counterpart to `ShareLinkService` (Phase 1's
 * Digital Business Card share link) — same interface shape, kept separate
 * because it resolves a different domain object. See
 * `LocalInvoiceShareLinkService` for today's backend-free implementation and
 * `MVP_BUILD_PLAN.md`'s "server-hosted share links" open decision for the
 * future `RemoteInvoiceShareLinkService` this could be swapped for.
 */
export interface InvoiceShareLinkService {
  /** Returns the link an invoice's "Share link" action should use. */
  getShareLink(invoice: Invoice): string;
}
