import { z } from 'zod';

import { isValidPhone } from '@/domain/businessCard/validation';

const optionalTrimmed = () =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const phoneField = optionalTrimmed().refine((value) => value === null || isValidPhone(value), {
  message: 'Enter a valid phone number (7–15 digits).',
});

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required.').max(160, 'Name is too long.'),
  phone: phoneField,
  email: optionalTrimmed().refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    { message: 'Enter a valid email address.' },
  ),
  address: optionalTrimmed(),
  notes: optionalTrimmed(),
});

export type CustomerFormValues = z.input<typeof customerFormSchema>;
export type CustomerFormOutput = z.output<typeof customerFormSchema>;
