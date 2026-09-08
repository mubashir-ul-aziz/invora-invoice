/**
 * The **only** place payment-total arithmetic is implemented — per
 * `MVP_BUILD_PLAN.md`'s explicit "Implement centralized payment calculation
 * logic. Do not duplicate this calculation across screens." No screen sums
 * a list of payments itself; everything (Invoice Detail's payment summary,
 * Payment History rows, `PaymentTotalsRepository`, `CustomerActivityRepository`)
 * calls into this module instead.
 *
 * Mirrors `domain/invoice/calculations.ts`'s `sumInvoiceTotals`: it never
 * re-derives anything, only sums numbers it's handed.
 */

/** Rounds to the nearest cent — every value this module produces goes through this once, at the point it's computed. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Sums any list of payments' `amount` — the one place "how much has been paid" is added up. */
export function sumPayments(payments: { amount: number }[]): number {
  return round2(payments.reduce((total, payment) => total + payment.amount, 0));
}

/**
 * `grandTotal - amountPaid`, floored at 0 — per the worked example in
 * `MVP_BUILD_PLAN.md` §6.3 (Invoice $1,000, payments $300 + $200 ⇒ remaining
 * $500). Floored, not negative, because an invoice can never owe less than
 * nothing — see `overpaidAmount` for the other half of that story.
 */
export function remainingBalance(grandTotal: number, amountPaid: number): number {
  return round2(Math.max(0, grandTotal - amountPaid));
}

/**
 * The portion of `amountPaid` that exceeds `grandTotal` — 0 for every normal
 * (partial/fully paid) invoice. Recording a payment that pushes the total
 * paid past the invoice's grand total is allowed, not blocked (see
 * `domain/payment/validation.ts`): this is how that overpayment is surfaced
 * to the business owner instead of silently showing a nonsensical negative
 * "remaining" balance.
 */
export function overpaidAmount(grandTotal: number, amountPaid: number): number {
  return round2(Math.max(0, amountPaid - grandTotal));
}

export interface InvoicePaymentSummary {
  grandTotal: number;
  amountPaid: number;
  remaining: number;
  overpaid: number;
}

/** Convenience: every number Invoice Detail's payment summary section needs, computed once. */
export function summarizeInvoicePayments(grandTotal: number, payments: { amount: number }[]): InvoicePaymentSummary {
  const amountPaid = sumPayments(payments);
  return {
    grandTotal,
    amountPaid,
    remaining: remainingBalance(grandTotal, amountPaid),
    overpaid: overpaidAmount(grandTotal, amountPaid),
  };
}
