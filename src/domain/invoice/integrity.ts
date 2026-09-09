import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';

import type { InvoiceItemInput } from './types';

/**
 * Data-integrity error thrown when a write would violate "one invoice, one
 * pricing method" (§1/§21-23 of the brief). Kept as its own error class
 * (rather than a plain `Error`) so callers — repository tests, a future API
 * layer — can distinguish "the request was malformed" from "the database
 * blew up" without string-matching a message.
 */
export class PricingMethodMismatchError extends Error {
  constructor(invoiceTypeId: InvoiceTypeId, lineIndex: number, linePricingMethodId: InvoiceTypeId) {
    super(
      `Invoice line ${lineIndex + 1} uses "${linePricingMethodId}" pricing but this invoice's pricing method is "${invoiceTypeId}". Every line on an invoice must use the invoice's pricing method.`,
    );
    this.name = 'PricingMethodMismatchError';
  }
}

/**
 * The backend-authority guard behind "the backend must reject an invoice
 * containing mixed pricing methods" (§21). Every repository write
 * (`SqliteInvoiceRepository`, `InMemoryInvoiceRepository`) calls this before
 * computing/persisting a single number, so a request that somehow bypassed
 * the UI's own restrictions (§15/§16 — the item picker and custom-line
 * flow both only ever produce lines in the invoice's own method) still can't
 * corrupt an invoice's totals with an incompatible line.
 *
 * `line.pricingMethodId` is optional on `InvoiceItemInput` — every line the
 * app itself creates (`domain/invoice/snapshot.ts`) always stamps it with
 * the invoice's own method, so in practice this only ever *rejects*; it
 * never needs to *require* the field, which keeps every existing caller
 * that predates this field (tests, in particular) unaffected as long as
 * they don't explicitly set a conflicting value.
 */
export function assertLinesMatchPricingMethod(
  invoiceTypeId: InvoiceTypeId,
  lines: Pick<InvoiceItemInput, 'pricingMethodId'>[],
): void {
  lines.forEach((line, index) => {
    if (line.pricingMethodId && line.pricingMethodId !== invoiceTypeId) {
      throw new PricingMethodMismatchError(invoiceTypeId, index, line.pricingMethodId);
    }
  });
}
