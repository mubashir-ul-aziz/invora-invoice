import { z } from 'zod';

import { isValidPhone, isValidUrl, normalizeUrl } from '@/domain/businessCard/validation';

/**
 * Phone/URL normalization and validation are shared with the Digital
 * Business Card form (`domain/businessCard/validation.ts`) rather than
 * redefined here — same rules, one implementation.
 */
const optionalTrimmed = () =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const phoneField = optionalTrimmed().refine(
  (value) => value === null || isValidPhone(value),
  { message: 'Enter a valid phone number (7–15 digits).' },
);

const urlField = (label: string) =>
  optionalTrimmed()
    .refine((value) => value === null || isValidUrl(value), {
      message: `Enter a valid ${label} URL.`,
    })
    .transform((value) => (value === null ? null : normalizeUrl(value)));

const currencyField = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code, e.g. USD.')
  .transform((value) => value.toUpperCase());

const invoicePrefixField = z
  .string()
  .trim()
  .max(12, 'Keep the prefix short (max 12 characters).')
  .transform((value) => value || 'INV-');

const nextInvoiceNumberField = z.coerce
  .number({ message: 'Enter a whole number.' })
  .int('Must be a whole number.')
  .min(1, 'Must be 1 or more.');

export const businessProfileFormSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, 'Business name is required.')
    .max(120, 'Business name is too long.'),
  logoUri: optionalTrimmed(),
  address: optionalTrimmed(),
  phone: phoneField,
  email: optionalTrimmed().refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    { message: 'Enter a valid email address.' },
  ),
  website: urlField('website'),
  currency: currencyField,
  taxId: optionalTrimmed(),
  invoicePrefix: invoicePrefixField,
  nextInvoiceNumber: nextInvoiceNumberField,
});

export type BusinessProfileFormValues = z.input<typeof businessProfileFormSchema>;
export type BusinessProfileFormOutput = z.output<typeof businessProfileFormSchema>;

export const invoiceSettingsFormSchema = z.object({
  invoicePrefix: invoicePrefixField,
  nextInvoiceNumber: nextInvoiceNumberField,
  currency: currencyField,
  defaultTaxRate: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || (/^\d+(\.\d+)?$/.test(value) && Number(value) <= 100),
      { message: 'Enter a tax rate between 0 and 100.' },
    )
    .transform((value) => (value === null ? null : Number(value))),
  defaultPaymentTermsDays: z.number().int().min(0).nullable(),
  defaultInvoiceTemplate: z.enum(['classic', 'modern', 'compact']),
  invoiceType: z.enum(['general', 'quantity', 'weight', 'dimension', 'custom']),
});

export type InvoiceSettingsFormValues = z.input<typeof invoiceSettingsFormSchema>;
export type InvoiceSettingsFormOutput = z.output<typeof invoiceSettingsFormSchema>;
