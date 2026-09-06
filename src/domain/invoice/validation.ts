import { z } from 'zod';

/**
 * Zod schemas for the two forms in the invoice-creation flow: one invoice
 * line (dynamic fields, but validated with one static schema covering every
 * possible field — the resolved `InvoiceFieldConfig` controls which fields
 * are actually *rendered*, exactly like `domain/item/validation.ts`'s
 * `itemFormSchema` does for weight/length/width/height) and the
 * date/notes/terms step on Invoice Review.
 */

const optionalTrimmed = () =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const requiredDecimalField = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => /^\d+(\.\d+)?$/.test(value), { message: `Enter a valid ${label}.` })
    .transform((value) => Number(value));

const optionalDecimalField = (label: string) =>
  optionalTrimmed()
    .refine((value) => value === null || /^\d+(\.\d+)?$/.test(value), {
      message: `Enter a valid ${label}.`,
    })
    .transform((value) => (value === null ? null : Number(value)));

const optionalPercentField = optionalTrimmed()
  .refine((value) => value === null || (/^\d+(\.\d+)?$/.test(value) && Number(value) <= 100), {
    message: 'Enter a percentage between 0 and 100.',
  })
  .transform((value) => (value === null ? null : Number(value)));

export const invoiceLineFormSchema = z.object({
  itemName: z.string().trim().min(1, 'Item name is required.').max(160, 'Item name is too long.'),
  description: optionalTrimmed(),
  sku: optionalTrimmed(),
  quantity: optionalDecimalField('quantity'),
  unit: optionalTrimmed(),
  weight: optionalDecimalField('weight'),
  length: optionalDecimalField('length'),
  width: optionalDecimalField('width'),
  height: optionalDecimalField('height'),
  unitPrice: requiredDecimalField('unit price'),
  discountPercent: optionalPercentField,
  taxPercent: optionalPercentField,
});

export type InvoiceLineFormValues = z.input<typeof invoiceLineFormSchema>;
export type InvoiceLineFormOutput = z.output<typeof invoiceLineFormSchema>;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/** Rejects both malformed strings and calendar-invalid dates (e.g. `2026-02-30`). */
function isValidCalendarDate(value: string): boolean {
  if (!isoDatePattern.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const requiredDateField = z
  .string()
  .trim()
  .refine(isValidCalendarDate, { message: 'Enter a valid date (YYYY-MM-DD).' });

const optionalDateField = optionalTrimmed().refine(
  (value) => value === null || isValidCalendarDate(value),
  { message: 'Enter a valid date (YYYY-MM-DD).' },
);

export const invoiceDetailsFormSchema = z
  .object({
    issueDate: requiredDateField,
    dueDate: optionalDateField,
    notes: optionalTrimmed(),
    terms: optionalTrimmed(),
  })
  .refine((data) => !data.dueDate || data.dueDate >= data.issueDate, {
    message: 'Due date cannot be before the issue date.',
    path: ['dueDate'],
  });

export type InvoiceDetailsFormValues = z.input<typeof invoiceDetailsFormSchema>;
export type InvoiceDetailsFormOutput = z.output<typeof invoiceDetailsFormSchema>;
