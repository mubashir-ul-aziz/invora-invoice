import type { BusinessProfileFormOutput, InvoiceSettingsFormOutput } from './validation';
import type {
  BusinessProfile,
  BusinessProfileInput,
  InvoiceSettings,
  InvoiceSettingsInput,
  InvoiceTemplate,
} from './types';
import { EMPTY_BUSINESS_PROFILE_INPUT, EMPTY_INVOICE_SETTINGS_INPUT } from './types';

/** Profile (or nothing, for "not saved yet") -> flat form default values. */
export function profileToFormDefaults(profile: BusinessProfile | null) {
  const input = profile ?? EMPTY_BUSINESS_PROFILE_INPUT;
  return {
    businessName: input.businessName,
    logoUri: input.logoUri ?? '',
    address: input.address ?? '',
    phone: input.phone ?? '',
    email: input.email ?? '',
    website: input.website ?? '',
    currency: input.currency || 'USD',
    taxId: input.taxId ?? '',
    invoicePrefix: input.invoicePrefix || 'INV-',
    nextInvoiceNumber: String(input.nextInvoiceNumber ?? 1),
  };
}

/** Validated flat form output -> the shape the repository expects. */
export function formValuesToProfileInput(values: BusinessProfileFormOutput): BusinessProfileInput {
  return {
    businessName: values.businessName,
    logoUri: values.logoUri,
    address: values.address,
    phone: values.phone,
    email: values.email,
    website: values.website,
    currency: values.currency,
    taxId: values.taxId,
    invoicePrefix: values.invoicePrefix,
    nextInvoiceNumber: values.nextInvoiceNumber,
  };
}

/** Settings (or nothing, for "not saved yet") -> flat form default values. */
export function settingsToFormDefaults(settings: InvoiceSettings | null) {
  const input = settings ?? EMPTY_INVOICE_SETTINGS_INPUT;
  return {
    invoicePrefix: input.invoicePrefix || 'INV-',
    nextInvoiceNumber: String(input.nextInvoiceNumber ?? 1),
    currency: input.currency || 'USD',
    defaultTaxRate: input.defaultTaxRate != null ? String(input.defaultTaxRate) : '',
    defaultPaymentTermsDays: input.defaultPaymentTermsDays,
    defaultInvoiceTemplate: input.defaultInvoiceTemplate,
    invoiceType: input.invoiceType,
  };
}

/** Validated flat form output -> the shape the repository expects. */
export function formValuesToSettingsInput(
  values: InvoiceSettingsFormOutput,
): InvoiceSettingsInput {
  return {
    invoicePrefix: values.invoicePrefix,
    nextInvoiceNumber: values.nextInvoiceNumber,
    currency: values.currency,
    defaultTaxRate: values.defaultTaxRate,
    defaultPaymentTermsDays: values.defaultPaymentTermsDays,
    defaultInvoiceTemplate: values.defaultInvoiceTemplate,
    invoiceType: values.invoiceType,
  };
}

/**
 * Merges a chosen template into the current invoice settings (or the
 * empty-state defaults, if nothing was ever saved) — everything else passes
 * through unchanged. Lets the dedicated Invoice Templates screen (Phase 10)
 * save just the one field it owns through the same `saveInvoiceSettings()`
 * the Invoice Settings form already uses, without needing its own repository
 * method or clobbering prefix/numbering/currency/tax/terms.
 */
export function settingsWithTemplate(
  settings: InvoiceSettings | null,
  defaultInvoiceTemplate: InvoiceTemplate,
): InvoiceSettingsInput {
  const base = settings ?? EMPTY_INVOICE_SETTINGS_INPUT;
  return {
    invoicePrefix: base.invoicePrefix,
    nextInvoiceNumber: base.nextInvoiceNumber,
    currency: base.currency,
    defaultTaxRate: base.defaultTaxRate,
    defaultPaymentTermsDays: base.defaultPaymentTermsDays,
    defaultInvoiceTemplate,
    invoiceType: base.invoiceType,
  };
}
