import { z } from 'zod';

import { getInvoiceTypeDefinition, type InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';

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

const baseInvoiceLineFormSchema = z.object({
  itemName: z.string().trim().min(1, 'Item name is required.').max(160, 'Item name is too long.'),
  description: optionalTrimmed(),
  sku: optionalTrimmed(),
  quantity: optionalDecimalField('quantity'),
  unit: optionalTrimmed(),
  weight: optionalDecimalField('weight'),
  weightUnit: optionalTrimmed(),
  length: optionalDecimalField('length'),
  width: optionalDecimalField('width'),
  height: optionalDecimalField('height'),
  lengthUnit: optionalTrimmed(),
  timeUnit: optionalTrimmed(),
  unitPrice: requiredDecimalField('unit price'),
  discountPercent: optionalPercentField,
  taxPercent: optionalPercentField,
});

/** The base schema with no pricing-method-specific requirements layered on — used where the method isn't known/relevant (e.g. some existing tests). */
export const invoiceLineFormSchema = baseInvoiceLineFormSchema;

/**
 * Per-Pricing-Method requirements (§20 of the brief), layered onto the base
 * schema exactly like `domain/item/validation.ts`'s `itemFormSchema` does:
 * WEIGHT requires weight > 0, AREA requires length/width > 0, VOLUME also
 * requires height > 0, LENGTH requires length > 0, TIME requires a
 * duration > 0 (carried in the `quantity` field for that method), and the
 * plain quantity-priced methods (General/Quantity/Service/Custom) require
 * quantity > 0 when the field is present at all.
 */
export function invoiceLineFormSchemaForPricingMethod(pricingMethodId: InvoiceTypeId) {
  const { calculationKind } = getInvoiceTypeDefinition(pricingMethodId);
  return baseInvoiceLineFormSchema.superRefine((values, ctx) => {
    const positive = (value: number | null, field: keyof typeof values, message: string) => {
      if (value === null || value <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
      }
    };
    switch (calculationKind) {
      case 'weight':
        positive(values.weight, 'weight', 'Enter a weight greater than 0.');
        break;
      case 'length':
        positive(values.length, 'length', 'Enter a length greater than 0.');
        break;
      case 'area':
        positive(values.length, 'length', 'Enter a length greater than 0.');
        positive(values.width, 'width', 'Enter a width greater than 0.');
        break;
      case 'volume':
        positive(values.length, 'length', 'Enter a length greater than 0.');
        positive(values.width, 'width', 'Enter a width greater than 0.');
        positive(values.height, 'height', 'Enter a height greater than 0.');
        break;
      case 'time':
        positive(values.quantity, 'quantity', 'Enter a duration greater than 0.');
        break;
      case 'quantityTimesPrice':
      default:
        if (values.quantity !== null) {
          positive(values.quantity, 'quantity', 'Enter a quantity greater than 0.');
        }
        break;
    }
  });
}

export type InvoiceLineFormValues = z.input<typeof baseInvoiceLineFormSchema>;
export type InvoiceLineFormOutput = z.output<typeof baseInvoiceLineFormSchema>;

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
