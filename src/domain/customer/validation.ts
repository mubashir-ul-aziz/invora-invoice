import { z } from 'zod';

import { isValidPhone, isValidUrl, normalizeUrl } from '@/domain/businessCard/validation';

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

/** Same normalize-then-validate shape as the business card form's `urlField` (`domain/businessCard/validation.ts`). */
const websiteField = optionalTrimmed()
  .refine((value) => value === null || isValidUrl(value), { message: 'Enter a valid website URL.' })
  .transform((value) => (value === null ? null : normalizeUrl(value)));

export const NOTES_MAX_LENGTH = 500;

const notesField = z
  .string()
  .trim()
  .max(NOTES_MAX_LENGTH, `Notes must be ${NOTES_MAX_LENGTH} characters or fewer.`)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required.').max(160, 'Name is too long.'),
  phone: phoneField,
  email: optionalTrimmed().refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    { message: 'Enter a valid email address.' },
  ),
  website: websiteField,
  address: optionalTrimmed(),
  notes: notesField,
});

export type CustomerFormValues = z.input<typeof customerFormSchema>;
export type CustomerFormOutput = z.output<typeof customerFormSchema>;
