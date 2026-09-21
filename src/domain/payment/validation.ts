import { z } from 'zod';

/**
 * Zod schema for the Record/Edit Payment form. `amount` must be a positive
 * number — a zero or negative payment isn't a real payment. The invoice's
 * remaining balance is enforced separately by `paymentFormSchemaWithMinDate`'s
 * optional `maxAmount` — see that function's doc comment.
 */

const optionalTrimmed = () =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/** Rejects both malformed strings and calendar-invalid dates (e.g. `2026-02-30`) — mirrors `domain/invoice/validation.ts`. */
function isValidCalendarDate(value: string): boolean {
  if (!isoDatePattern.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const paymentFormSchema = z.object({
  amount: z
    .string()
    .trim()
    .refine((value) => /^\d+(\.\d+)?$/.test(value) && Number(value) > 0, {
      message: 'Enter an amount greater than 0.',
    })
    .transform((value) => Number(value)),
  paymentDate: z
    .string()
    .trim()
    .refine(isValidCalendarDate, { message: 'Enter a valid date (YYYY-MM-DD).' }),
  method: z.enum(['cash', 'bank_transfer', 'card', 'paypal', 'other']),
  reference: optionalTrimmed(),
  notes: optionalTrimmed(),
});

export type PaymentFormValues = z.input<typeof paymentFormSchema>;
export type PaymentFormOutput = z.output<typeof paymentFormSchema>;

/**
 * `paymentFormSchema` plus "payment date can't be before the invoice's own
 * issue date" — a payment can never predate the invoice it's for (e.g. an
 * invoice issued 2026-09-11 can't record a payment dated 2026-09-10) — and
 * optionally "amount can't exceed `maxAmount`" (the invoice's remaining
 * balance — see `RecordPaymentScreen`, which passes `summary.remaining`, and
 * `EditPaymentScreen`, which passes `summary.remaining + payment.amount`
 * since the edited amount replaces, rather than adds to, its own current
 * contribution to `amountPaid`). Layered on as a separate schema (rather than
 * baked into `paymentFormSchema` itself) since both bounds are only known
 * once the invoice has loaded — see `RecordPaymentScreen`/`EditPaymentScreen`,
 * which build this once the invoice's data is available and mount the form
 * from that point on. `minDate`/`maxAmount` of `null`/`undefined` (invoice not
 * loaded yet) applies no extra bound.
 */
export function paymentFormSchemaWithMinDate(minDate: string | null, maxAmount?: number | null) {
  return paymentFormSchema
    .refine((data) => !minDate || data.paymentDate >= minDate, {
      message: `Payment date can't be before the invoice date${minDate ? ` (${minDate})` : ''}.`,
      path: ['paymentDate'],
    })
    .refine((data) => maxAmount == null || data.amount <= maxAmount, {
      message: maxAmount == null ? 'Amount exceeds the remaining balance.' : `Amount can't exceed the remaining balance (${maxAmount.toFixed(2)}).`,
      path: ['amount'],
    });
}
