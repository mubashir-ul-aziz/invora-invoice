/**
 * The **only** place invoice line/total arithmetic is implemented. Per
 * `MVP_BUILD_PLAN.md` §3 ("Business calculations ... must not live inside UI
 * components"), every screen and store that needs a subtotal, a discount, a
 * tax amount, or a grand total calls into this module instead of computing
 * it inline. Two entry points:
 *
 * - `calculateLineTotal` — turns one not-yet-saved line's raw inputs
 *   (quantity/unit price/discount %/tax %) into its four numbers. Called
 *   live while editing a line (for preview) and once more by the repository
 *   at save time, to freeze the numbers onto the `InvoiceItemSnapshot`.
 * - `sumInvoiceTotals` — adds up any list of already-computed line numbers
 *   (draft preview lines *or* frozen historical snapshot rows) into the
 *   invoice-level Subtotal/Discount/Tax/Grand total. It never re-derives a
 *   line's numbers from quantity/price/discount/tax — only sums numbers it's
 *   handed — so summing a saved invoice's historical lines can never produce
 *   a different grand total than what the invoice originally showed, even if
 *   `calculateLineTotal`'s formula changes later.
 */

export interface LineCalcInput {
  /** Null when "Quantity" isn't part of the invoice's field set — treated as 1 (a line without a quantity field is still exactly one of that item). */
  quantity: number | null;
  unitPrice: number;
  /** Percentage (0–100); null = no discount. */
  discountPercent: number | null;
  /** Percentage (0–100); null = no tax. */
  taxPercent: number | null;
}

export interface LineCalcResult {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export const EMPTY_INVOICE_TOTALS: InvoiceTotals = {
  subtotal: 0,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 0,
};

/** Rounds to the nearest cent — every value this module produces goes through this once, at the point it's computed. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * quantity × unit price = subtotal; discount % is taken off the subtotal;
 * tax % is applied to the post-discount (taxable) amount — the conventional
 * "tax on the discounted price" order, not tax-then-discount.
 */
export function calculateLineTotal(input: LineCalcInput): LineCalcResult {
  const quantity = input.quantity ?? 1;
  const subtotal = round2(quantity * input.unitPrice);
  const discountAmount = round2(subtotal * ((input.discountPercent ?? 0) / 100));
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = round2(taxableAmount * ((input.taxPercent ?? 0) / 100));
  const lineTotal = round2(taxableAmount + taxAmount);
  return { subtotal, discountAmount, taxAmount, lineTotal };
}

/** Sums any list of already-computed line results — never recomputes them. See the module doc comment above. */
export function sumInvoiceTotals(
  lines: Pick<LineCalcResult, 'subtotal' | 'discountAmount' | 'taxAmount' | 'lineTotal'>[],
): InvoiceTotals {
  return lines.reduce(
    (totals, line) => ({
      subtotal: round2(totals.subtotal + line.subtotal),
      discountTotal: round2(totals.discountTotal + line.discountAmount),
      taxTotal: round2(totals.taxTotal + line.taxAmount),
      grandTotal: round2(totals.grandTotal + line.lineTotal),
    }),
    { ...EMPTY_INVOICE_TOTALS },
  );
}

/** Convenience for the not-yet-saved draft: computes every line, then sums them — the Review screen's live preview. */
export function calculateInvoiceTotals(lines: LineCalcInput[]): InvoiceTotals {
  return sumInvoiceTotals(lines.map(calculateLineTotal));
}
