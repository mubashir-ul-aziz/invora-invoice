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

export const itemFormSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required.').max(160, 'Item name is too long.'),
  description: optionalTrimmed(),
  sku: optionalTrimmed(),
  unit: optionalTrimmed(),
  defaultPrice: requiredDecimalField('price'),
  taxRate: optionalPercentField,
  weight: optionalDecimalField('weight'),
  length: optionalDecimalField('length'),
  width: optionalDecimalField('width'),
  height: optionalDecimalField('height'),
  invoiceTypeId: z.enum(['general', 'quantity', 'weight', 'dimension', 'custom']),
});

export type ItemFormValues = z.input<typeof itemFormSchema>;
export type ItemFormOutput = z.output<typeof itemFormSchema>;
