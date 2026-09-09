import { z } from 'zod';

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
    message: 'Enter a tax rate between 0 and 100.',
  })
  .transform((value) => (value === null ? null : Number(value)));

const PRICING_METHOD_IDS = [
  'general',
  'quantity',
  'weight',
  'length',
  'area',
  'volume',
  'time',
  'service',
  'custom',
] as const;

const baseItemFormSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required.').max(160, 'Item name is too long.'),
  description: optionalTrimmed(),
  sku: optionalTrimmed(),
  unit: optionalTrimmed(),
  defaultPrice: requiredDecimalField('price'),
  taxRate: optionalPercentField,
  weight: optionalDecimalField('weight'),
  weightUnit: optionalTrimmed(),
  length: optionalDecimalField('length'),
  width: optionalDecimalField('width'),
  height: optionalDecimalField('height'),
  lengthUnit: optionalTrimmed(),
  invoiceTypeId: z.enum(PRICING_METHOD_IDS),
});

/**
 * Per-Pricing-Method requirements (§20 of the brief: "every pricing method
 * must have proper validation" — weight > 0 for WEIGHT, length/width > 0 for
 * AREA, etc.). Layered onto the shared base schema with `superRefine` rather
 * than a separate schema per method, so the ~90% every method has in common
 * (name/price/tax/discount) is never duplicated.
 */
export const itemFormSchema = baseItemFormSchema.superRefine((values, ctx) => {
  const positive = (value: number | null, field: keyof typeof values, message: string) => {
    if (value === null || value <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
    }
  };
  switch (values.invoiceTypeId) {
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
    default:
      break;
  }
});

export type ItemFormValues = z.input<typeof itemFormSchema>;
export type ItemFormOutput = z.output<typeof itemFormSchema>;
