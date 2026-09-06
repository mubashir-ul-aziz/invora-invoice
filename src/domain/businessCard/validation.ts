import { z } from 'zod';

/** Strips everything but digits and a single leading `+`. */
export function normalizePhoneDigits(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  return (hasPlus ? '+' : '') + digits;
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhoneDigits(phone);
  return /^\+?[0-9]{7,15}$/.test(normalized);
}

/** Adds an `https://` scheme when the user typed a bare domain, e.g. "example.com". */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function isValidUrl(url: string): boolean {
  try {
    const normalized = normalizeUrl(url);
    const parsed = new URL(normalized);
    return /^https?:$/.test(parsed.protocol) && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

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

export const socialLinkSchema = z.object({
  platform: z.enum(['whatsapp', 'facebook', 'instagram', 'googleMaps']),
  value: z.string().trim().min(1),
});

export const businessCardFormSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, 'Business name is required.')
    .max(120, 'Business name is too long.'),
  ownerName: optionalTrimmed(),
  logoUri: optionalTrimmed(),
  phone: phoneField,
  email: optionalTrimmed().refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    { message: 'Enter a valid email address.' },
  ),
  website: urlField('website'),
  address: optionalTrimmed(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code, e.g. USD.')
    .transform((value) => value.toUpperCase()),
  taxId: optionalTrimmed(),
  whatsapp: phoneField,
  facebook: urlField('Facebook'),
  instagram: urlField('Instagram'),
  googleMapsUrl: urlField('Google Maps'),
});

export type BusinessCardFormValues = z.input<typeof businessCardFormSchema>;
export type BusinessCardFormOutput = z.output<typeof businessCardFormSchema>;
