import type {
  BusinessProfile,
  BusinessProfileInput,
  InvoiceSettings,
  InvoiceSettingsInput,
} from '@/domain/business/types';
import type { InvoiceTypeSelection, InvoiceTypeSelectionInput } from '@/domain/invoiceType/types';

/**
 * The only door the state/controller layer is allowed to use to reach
 * business-profile / invoice-settings / invoice-type data. Screens/
 * components never import a concrete repository, Drizzle table, or the
 * sqlite client directly.
 *
 * All three halves of this interface read/write the *same* on-device
 * `business` row that `BusinessCardRepository` (Phase 1) uses — see
 * `SqliteBusinessRepository` for how the columns are shared without either
 * side clobbering the other's fields.
 */
export interface BusinessRepository {
  /** Returns the business profile, or null if none was ever saved. */
  getProfile(): Promise<BusinessProfile | null>;
  /** Creates the business row on first save, or updates the existing one. */
  saveProfile(input: BusinessProfileInput): Promise<BusinessProfile>;

  /** Returns the invoice settings, or null if none was ever saved. */
  getInvoiceSettings(): Promise<InvoiceSettings | null>;
  /** Creates the business row on first save, or updates the existing one. */
  saveInvoiceSettings(input: InvoiceSettingsInput): Promise<InvoiceSettings>;

  /**
   * Returns the invoice type / domain selection (Phase 3), or null if none
   * was ever saved. Shares the `invoiceType` column with
   * `getInvoiceSettings()` above (either screen can change which type is
   * selected — same convention as `invoicePrefix`/`nextInvoiceNumber`/
   * `currency` being editable from both Business Profile and Invoice
   * Settings) and additionally exposes the custom field-key list.
   */
  getInvoiceTypeSelection(): Promise<InvoiceTypeSelection | null>;
  /** Creates the business row on first save, or updates the existing one. */
  saveInvoiceTypeSelection(input: InvoiceTypeSelectionInput): Promise<InvoiceTypeSelection>;

  /**
   * Atomically reads the current `invoicePrefix`/`nextInvoiceNumber`, formats
   * the number the *next* invoice should use, and increments the stored
   * counter by one so no later call can reserve the same number — the
   * "prevent accidental duplicate invoice numbers" rule from
   * `MVP_BUILD_PLAN.md`'s Phase 6 brief. Called exactly once, by
   * `InvoiceRepository.create()`'s caller (`invoiceStore`), right before
   * persisting a brand-new invoice. If persistence then fails for an
   * unrelated reason, the reserved number is not reused — a small gap is
   * preferable to a duplicate.
   */
  reserveNextInvoiceNumber(): Promise<string>;
}
