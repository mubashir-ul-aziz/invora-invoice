import type { Customer } from '@/domain/customer/types';
import type { Invoice } from '@/domain/invoice/types';
import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import type { Item } from '@/domain/item/types';

export type RootStackParamList = {
  /** The app's home screen (Phase 8) — Total Sales/Paid/Outstanding/Overdue/invoice count, recent invoices, and the three quick actions. */
  Dashboard: undefined;
  DigitalCard: undefined;
  EditBusinessCard: undefined;
  QRCode: undefined;
  ShareCard: undefined;
  Business: undefined;
  EditBusiness: undefined;
  BusinessSettings: undefined;
  InvoiceSettings: undefined;
  InvoiceTypeSelection: undefined;
  CustomInvoiceType: undefined;
  /**
   * `onSelectItem`, when provided, puts the screen in "picker" mode for a
   * future invoice-creation flow (Phase 6): tapping a row calls it with the
   * chosen item and navigates back, instead of opening Edit Item. Undefined
   * (the normal case, reached from the Items entry point) is plain
   * management mode.
   */
  /**
   * `requiredPricingMethodId`, when set alongside `onSelectItem`, is the
   * invoice-picker's compatibility guard (§15 of the brief): the list is
   * locked to that Pricing Method, and picking an item of a different one
   * is refused with an explanation rather than silently added.
   */
  ItemList: { onSelectItem?: (item: Item) => void; requiredPricingMethodId?: InvoiceTypeId } | undefined;
  /**
   * `onCreated`, when provided (e.g. a future "+ New item" action inside the
   * invoice item picker), is called with the newly created item instead of
   * just navigating back — this is the "add item while creating invoice"
   * hook the brief asks for, built now so Phase 6 doesn't need to touch this
   * screen.
   */
  /** `defaultInvoiceTypeId`, when set (the invoice item picker's "+ New item"), preselects that Pricing Method so a business owner can't create an item this invoice couldn't use. */
  CreateItem: { onCreated?: (item: Item) => void; defaultInvoiceTypeId?: InvoiceTypeId } | undefined;
  EditItem: { itemId: string };
  /**
   * `onSelectCustomer`, when provided, puts the screen in "picker" mode for a
   * future invoice-creation flow (Phase 6): tapping a row calls it with the
   * chosen customer and navigates back, instead of opening Customer Detail.
   * Undefined (the normal case, reached from the Customers entry point) is
   * plain management mode. Mirrors `ItemList`'s picker mode from Phase 4.
   */
  CustomerList: { onSelectCustomer?: (customer: Customer) => void } | undefined;
  /**
   * `onCreated`, when provided, is called with the newly created customer
   * instead of just navigating back — the same "add while creating an
   * invoice" hook Phase 4 built for items, built now so Phase 6 doesn't need
   * to touch this screen.
   */
  CreateCustomer: { onCreated?: (customer: Customer) => void } | undefined;
  EditCustomer: { customerId: string };
  CustomerDetail: { customerId: string };
  CustomerHistory: { customerId: string };
  /**
   * Invoice List. "Create Invoice – Customer" (the brief's screen #2) is
   * deliberately not a separate route: it's `CustomerList` in picker mode
   * (`onSelectCustomer`), reused exactly as Phase 5 built it for this — see
   * `MVP_BUILD_PLAN.md`'s Phase 6 notes.
   *
   * `onSelectInvoice`/`customerId` (Phase 7) put the screen in the same kind
   * of "picker" mode `CustomerList`/`ItemList` already have: Customer
   * Detail's "Record payment" action needs the customer's own invoice picked
   * first (a payment always belongs to one invoice), and reuses this screen
   * instead of a second, near-duplicate list. `customerId`, when set, scopes
   * the list to that customer for the lifetime of this screen instance only
   * (see `InvoiceListScreen`'s cleanup effect) — it never leaks into the
   * plain "Invoices" tab's global filter. The Dashboard's "Record payment"
   * quick action (Phase 8) reuses the same picker mode with `customerId`
   * left unset, since it isn't scoped to one customer.
   */
  InvoiceList: { onSelectInvoice?: (invoice: Invoice) => void; customerId?: string } | undefined;
  /** "Create Invoice – Items": add/edit line items for the in-progress draft in `invoiceDraftStore`. Also reused for Edit Invoice and Duplicate Invoice's "edit items" step. */
  CreateInvoiceItems: undefined;
  /** `lineIndex: null` = adding a new line; a number edits `invoiceDraftStore`'s existing line at that index. */
  EditInvoiceLine: { lineIndex: number | null };
  /** Invoice Review — dates/notes/terms + totals + Save. Behavior branches on `invoiceDraftStore.mode` ('create' | 'edit' | 'duplicate'). */
  InvoiceReview: undefined;
  InvoiceDetail: { invoiceId: string };
  /** Loads the invoice into `invoiceDraftStore` (`startEdit`) then forwards into `CreateInvoiceItems`. */
  EditInvoice: { invoiceId: string };
  /** Record Payment (Phase 7). The invoice is fixed — chosen before navigating here (Invoice Detail's own "Record payment" action, or `InvoiceList` in picker mode from Customer Detail). */
  RecordPayment: { invoiceId: string };
  EditPayment: { paymentId: string };
  /** Payment History: every payment recorded, across every invoice/customer. */
  PaymentHistory: undefined;
  /** "Invoice PDF Preview" + "Invoice Sharing" (Phase 9) folded into one screen — reached from Invoice Detail's "Share / PDF" action. */
  InvoicePdfPreview: { invoiceId: string };
  /** Settings hub (Phase 10) — Business/Invoice/Backup/Security/Account sections, per `MVP_BUILD_PLAN.md` §7. */
  Settings: undefined;
  /** A dedicated Classic/Modern/Compact picker with a short description of each — the Invoice Settings chip-picker (Phase 2) remains a second, equally valid entry point to the same `defaultInvoiceTemplate` field, same "two entry points, one source of truth" convention Phase 3 established for Invoice Type. */
  InvoiceTemplates: undefined;
  /** App Lock + Biometric Unlock toggles. */
  Security: undefined;
  /** Account/Subscription placeholder + Logout — no real account system exists yet, per the explicit "do not implement unnecessary account features" instruction. */
  Account: undefined;
  /** "Backup & Restore" (Phase 11) — Google Drive sign-in, Automatic Backup toggle, "Backup Now", and the status summary. */
  Backup: undefined;
  /** "Backup History" (Phase 11) — Drive backups available to restore + the local backup/restore attempt log. */
  BackupHistory: undefined;
  /** "Cloud Backup" (Phase 12, optional/paid) — enabled/disabled toggle, storage usage/limits, last backup status, and "Backup Now". Google Drive backup (Phase 11) is unaffected — this is a second, independent backup destination, per `MVP_BUILD_PLAN.md` §4. */
  CloudBackup: undefined;
  /** "Cloud Backup History" (Phase 12) — cloud backups available to restore + the same `backup_log` history, filtered to `destination: 'cloud'`. */
  CloudBackupHistory: undefined;
  /** "Upgrade Storage" (Phase 12) — a placeholder plan picker; no real payment flow exists yet, see `data/subscription/CloudUpgradeService.ts`. */
  UpgradeStorage: undefined;
};
