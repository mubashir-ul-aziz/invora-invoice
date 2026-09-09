import { INVOICE_TYPE_REGISTRY, type InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';

/**
 * Business / Company + Invoice Settings domain types (Phase 2). Both map to
 * the *same* underlying `business` row that Phase 1's `BusinessCard` reads —
 * no duplicate entity is introduced. `BusinessProfile` and `InvoiceSettings`
 * are two feature-shaped views over overlapping columns (invoice prefix,
 * next invoice number, and currency are edited from either screen, per the
 * product brief), exactly like `BusinessCard` is a third view over the same
 * row for the Digital Business Card screens.
 */

export type InvoiceTemplate = 'classic' | 'modern' | 'compact';

/**
 * The business's default Pricing Method — this module only stores the
 * *selection* (the "entry point" the brief asks for on Business Settings;
 * the Invoice Settings screen's chip-picker is a second entry point to the
 * exact same underlying `business.invoice_type` column, same convention as
 * `InvoiceTemplate` above). Re-exported from `domain/invoiceType`'s registry
 * — the single Pricing Method catalog — rather than declared again here, so
 * the two entry points can never drift apart on which methods exist.
 */
export type InvoiceType = InvoiceTypeId;

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
  /**
   * Unique 6-digit business id (e.g. `"483920"`), generated once when the
   * business row is first created and never reassigned afterwards — see
   * `generateBusinessCode()` in `lib/id.ts`. Repository-managed, like `id`;
   * never accepted from user input and not part of `BusinessProfileInput`,
   * so nothing in the app can change it once set. It's the fixed half of
   * every invoice number this business issues — see `formatNextInvoiceNumber`
   * below.
   */
  businessCode: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  updatedAt: string;
}

/** Fields the Edit Business screen collects; id/businessCode/updatedAt are repository-managed. */
export type BusinessProfileInput = Omit<BusinessProfile, 'id' | 'updatedAt' | 'businessCode'>;

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
  /** Same repository-managed, immutable value as `BusinessProfile.businessCode` — shown here so this screen can display the invoice-number preview too. */
  businessCode: string;
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

export type InvoiceSettingsInput = Omit<InvoiceSettings, 'updatedAt' | 'businessCode'>;

export const EMPTY_INVOICE_SETTINGS_INPUT: InvoiceSettingsInput = {
  invoicePrefix: 'INV-',
  nextInvoiceNumber: 1,
  currency: 'USD',
  defaultTaxRate: null,
  defaultPaymentTermsDays: null,
  defaultInvoiceTemplate: 'classic',
  invoiceType: 'general',
};

/**
 * `description` is only rendered by the dedicated Invoice Templates screen
 * (Phase 10) — `InvoiceSettingsScreen`'s chip-picker only reads `label`, so
 * adding it here doesn't touch that existing usage. Wording matches what
 * `renderInvoiceHtml()` (Phase 9) actually produces for each template, not
 * an aspirational description.
 */
export const INVOICE_TEMPLATE_OPTIONS: { value: InvoiceTemplate; label: string; description: string }[] = [
  {
    value: 'classic',
    label: 'Classic',
    description: 'A plain, bordered black-and-white layout.',
  },
  {
    value: 'modern',
    label: 'Modern',
    description: 'A colored header band with accent-colored totals.',
  },
  {
    value: 'compact',
    label: 'Compact',
    description: 'Tighter spacing and smaller text for a denser, shorter document.',
  },
];

export const INVOICE_TYPE_OPTIONS: { value: InvoiceType; label: string }[] = INVOICE_TYPE_REGISTRY.map(
  (def) => ({ value: def.id, label: def.label }),
);

export const PAYMENT_TERMS_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'No default' },
  { value: 0, label: 'Due on receipt' },
  { value: 7, label: 'Net 7' },
  { value: 15, label: 'Net 15' },
  { value: 30, label: 'Net 30' },
  { value: 45, label: 'Net 45' },
  { value: 60, label: 'Net 60' },
];

/**
 * Formats an invoice number from the business's prefix, its fixed 6-digit
 * `businessCode`, and the sequential number — e.g. `"INV-483920-1"`. The
 * sequence (`nextNumber`) always advances 1, 2, 3, … via
 * `BusinessRepository.reserveNextInvoiceNumber()`; combining it with the
 * business code keeps every invoice number this business issues globally
 * distinguishable even if the prefix is later changed or left blank. Used
 * both to reserve the real number for a new invoice and to render the
 * read-only "next invoice number" preview on the Business/Invoice Settings
 * screens.
 */
export function formatNextInvoiceNumber(
  prefix: string,
  businessCode: string,
  nextNumber: number,
): string {
  return `${prefix}${businessCode}-${nextNumber}`;
}
