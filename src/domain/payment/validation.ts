import { z } from 'zod';

/**
 * Zod schema for the Record/Edit Payment form. `amount` must be a positive
 * number — a zero or negative payment isn't a real payment — but is
 * deliberately **not** capped at the invoice's remaining balance: overpayment
 * is allowed (see `domain/payment/calculations.ts`'s `overpaidAmount`), per
 * the explicit instruction to test overpayment handling rather than block it.
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
 * invoice issued 2026-09-11 can't record a payment dated 2026-09-10). Layered
 * on as a separate schema (rather than baked into `paymentFormSchema`
 * itself) since the bound is only known once the invoice has loaded — see
 * `RecordPaymentScreen`/`EditPaymentScreen`, which build this once the
 * invoice's `issueDate` is available and mount the form from that point on.
 * `minDate` of `null` (invoice not loaded yet) applies no extra bound.
 */
export function paymentFormSchemaWithMinDate(minDate: string | null) {
  return paymentFormSchema.refine((data) => !minDate || data.paymentDate >= minDate, {
    message: `Payment date can't be before the invoice date${minDate ? ` (${minDate})` : ''}.`,
    path: ['paymentDate'],
  });
}
