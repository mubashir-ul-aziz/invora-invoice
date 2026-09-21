import { derivePricingQuantity } from '@/domain/invoiceType/calculators';
import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';

import type { InvoiceItemInput, PriceMode } from './types';

/**
 * The **only** place invoice line/total arithmetic is implemented. Per the
 * brief ("business calculations must not live inside UI components"), every
 * screen and repository that needs a subtotal, a discount, a tax amount, or
 * a grand total calls into this module instead of computing it inline. Two
 * entry points:
 *
 * - `calculateLineTotal` — turns one not-yet-saved line's raw inputs into
 *   its four numbers, given the invoice's Pricing Method. Called live while
 *   editing a line (for preview) and once more by the repository at save
 *   time, to freeze the numbers onto the `InvoiceItemSnapshot` — the
 *   repository is the final authority (see `MVP_BUILD_PLAN.md`/the refactor
 *   report's "frontend previews, backend decides" rule).
 * - `sumInvoiceTotals` — adds up any list of already-computed line numbers
 *   (draft preview lines *or* frozen historical snapshot rows) into the
 *   invoice-level Subtotal/Discount/Tax/Grand total. It never re-derives a
 *   line's numbers — only sums numbers it's handed — so summing a saved
 *   invoice's historical lines can never produce a different grand total
 *   than what the invoice originally showed, even if `calculateLineTotal`'s
 *   formula changes later.
 */

export interface LineCalcInput {
  /** Null when "Quantity" isn't part of the invoice's field set — treated as 1 for quantity-priced methods (a line without a quantity field is still exactly one of that item). Ignored for WEIGHT/LENGTH/AREA/VOLUME, which derive their own billable quantity from weight/length/width/height instead. */
  quantity: number | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  /** Absent means `'unit'` — every caller that predates the Total Item Price feature keeps quantity × price. */
  priceMode?: PriceMode;
  unitPrice: number;
  /** The whole-line price. Only read when `priceMode` is `'total'`; used as the subtotal as-is, never multiplied by the quantity. */
  totalPrice?: number | null;
  /** Percentage (0–100); null = no discount. */
  discountPercent: number | null;
  /** Percentage (0–100); null = no tax. */
  taxPercent: number | null;
}

export interface LineCalcResult {
  /** The billable quantity actually used (quantity, weight, length, length×width, or length×width×height, depending on the pricing method) — surfaced so a line can show "20 m²" style previews without re-deriving it. */
  calculatedQuantity: number;
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
 * billable quantity × unit price = subtotal; discount % is taken off the
 * subtotal; tax % is applied to the post-discount (taxable) amount — the
 * conventional "tax on the discounted price" order, not tax-then-discount.
 *
 * The billable quantity is derived per the invoice's Pricing Method (§9 of
 * the brief) via `derivePricingQuantity` — WEIGHT uses weight, LENGTH uses
 * length, AREA uses length × width, VOLUME uses length × width × height,
 * TIME uses duration, everything else uses quantity (defaulting to 1).
 * `pricingMethodId` defaults to `'general'` (plain quantity × price) so
 * existing call sites that don't yet know the method keep their prior
 * behavior unchanged.
 *
 * Each line independently picks a price mode. `'unit'` (the default) is the
 * formula above; `'total'` takes the entered Total Item Price as the
 * subtotal directly — the calculated quantity is still derived (so it can be
 * shown) but is deliberately **not** part of the subtotal. Discount and tax
 * apply on top of either.
 */
export function calculateLineTotal(
  input: LineCalcInput,
  pricingMethodId: InvoiceTypeId = 'general',
): LineCalcResult {
  const calculatedQuantity = derivePricingQuantity(pricingMethodId, {
    quantity: input.quantity,
    weight: input.weight ?? null,
    length: input.length ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
  });
  const subtotal =
    input.priceMode === 'total' ? round2(input.totalPrice ?? 0) : round2(calculatedQuantity * input.unitPrice);
  const discountAmount = round2(subtotal * ((input.discountPercent ?? 0) / 100));
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = round2(taxableAmount * ((input.taxPercent ?? 0) / 100));
  const lineTotal = round2(taxableAmount + taxAmount);
  return { calculatedQuantity, subtotal, discountAmount, taxAmount, lineTotal };
}

/**
 * A line's editable fields -> `calculateLineTotal`'s input. Every call site
 * that prices a line (repositories, Create Items, Review, the line editor's
 * live preview) goes through this instead of hand-copying the field list, so
 * a pricing field can never be forgotten at one of them — which, for
 * `priceMode`/`totalPrice`, would silently multiply a Total Item Price by the
 * quantity.
 */
export function toLineCalcInput(
  line: Pick<
    InvoiceItemInput,
    'quantity' | 'weight' | 'length' | 'width' | 'height' | 'priceMode' | 'unitPrice' | 'totalPrice' | 'discountPercent' | 'taxPercent'
  >,
): LineCalcInput {
  return {
    quantity: line.quantity,
    weight: line.weight,
    length: line.length,
    width: line.width,
    height: line.height,
    priceMode: line.priceMode,
    unitPrice: line.unitPrice,
    totalPrice: line.totalPrice,
    discountPercent: line.discountPercent,
    taxPercent: line.taxPercent,
  };
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
export function calculateInvoiceTotals(
  lines: LineCalcInput[],
  pricingMethodId: InvoiceTypeId = 'general',
): InvoiceTotals {
  return sumInvoiceTotals(lines.map((line) => calculateLineTotal(line, pricingMethodId)));
}
