/**
 * Business / Company + Invoice Settings domain types (Phase 2). Both map to
 * the *same* underlying `business` row that Phase 1's `BusinessCard` reads —
 * no duplicate entity is introduced. `BusinessProfile` and `InvoiceSettings`
 * are two feature-shaped views over overlapping columns (invoice prefix,
 * next invoice number, and currency are edited from either screen, per the
 * product brief), exactly like `BusinessCard` is a third view over the same
 * row for the Digital Business Card screens.
 */

export type InvoiceTemplate = 'classic' | 'modern' | 'minimal';

/**
 * The invoice type/domain that determines which item fields appear on an
 * invoice. This module only stores the *selection* (the "entry point" the
 * brief asks for) — the field matrix / custom-field builder behind it is
 * Phase 3 (Invoice Type / Domain) scope.
 */
export type InvoiceType = 'general' | 'quantity' | 'weight' | 'dimension' | 'custom';

export interface BusinessProfile {
  id: string;
  businessName: string;
  /** Local file URI (e.g. from the image picker), or null when no logo is set. */
  logoUri: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  currency: string;
  /** Tax / VAT registration number. */
  taxId: string | null;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  updatedAt: string;
}

/** Fields the Edit Business screen collects; id/updatedAt are repository-managed. */
export type BusinessProfileInput = Omit<BusinessProfile, 'id' | 'updatedAt'>;

export const EMPTY_BUSINESS_PROFILE_INPUT: BusinessProfileInput = {
  businessName: '',
  logoUri: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  currency: 'USD',
  taxId: null,
  invoicePrefix: 'INV-',
  nextInvoiceNumber: 1,
};

export interface InvoiceSettings {
  invoicePrefix: string;
  nextInvoiceNumber: number;
  currency: string;
  /** Percentage (0–100); null means no default tax is applied to new invoices. */
  defaultTaxRate: number | null;
  /** Days until due; 0 = due on receipt; null means no default term is set. */
  defaultPaymentTermsDays: number | null;
  defaultInvoiceTemplate: InvoiceTemplate;
  invoiceType: InvoiceType;
  updatedAt: string;
}

export type InvoiceSettingsInput = Omit<InvoiceSettings, 'updatedAt'>;

export const EMPTY_INVOICE_SETTINGS_INPUT: InvoiceSettingsInput = {
  invoicePrefix: 'INV-',
  nextInvoiceNumber: 1,
  currency: 'USD',
  defaultTaxRate: null,
  defaultPaymentTermsDays: null,
  defaultInvoiceTemplate: 'classic',
  invoiceType: 'general',
};

export const INVOICE_TEMPLATE_OPTIONS: { value: InvoiceTemplate; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
  { value: 'minimal', label: 'Minimal' },
];

export const INVOICE_TYPE_OPTIONS: { value: InvoiceType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'weight', label: 'Weight' },
  { value: 'dimension', label: 'Dimension' },
  { value: 'custom', label: 'Custom' },
];

export const PAYMENT_TERMS_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'No default' },
  { value: 0, label: 'Due on receipt' },
  { value: 7, label: 'Net 7' },
  { value: 15, label: 'Net 15' },
  { value: 30, label: 'Net 30' },
  { value: 45, label: 'Net 45' },
  { value: 60, label: 'Net 60' },
];

/** Formats the next invoice number a new invoice would get, e.g. "INV-1". */
export function formatNextInvoiceNumber(prefix: string, nextNumber: number): string {
  return `${prefix}${nextNumber}`;
}
