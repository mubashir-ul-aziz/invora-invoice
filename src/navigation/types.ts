import type { Customer } from '@/domain/customer/types';
import type { Item } from '@/domain/item/types';

export type RootStackParamList = {
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
  ItemList: { onSelectItem?: (item: Item) => void } | undefined;
  /**
   * `onCreated`, when provided (e.g. a future "+ New item" action inside the
   * invoice item picker), is called with the newly created item instead of
   * just navigating back — this is the "add item while creating invoice"
   * hook the brief asks for, built now so Phase 6 doesn't need to touch this
   * screen.
   */
  CreateItem: { onCreated?: (item: Item) => void } | undefined;
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
   */
  InvoiceList: undefined;
  /** "Create Invoice – Items": add/edit line items for the in-progress draft in `invoiceDraftStore`. Also reused for Edit Invoice and Duplicate Invoice's "edit items" step. */
  CreateInvoiceItems: undefined;
  /** `lineIndex: null` = adding a new line; a number edits `invoiceDraftStore`'s existing line at that index. */
  EditInvoiceLine: { lineIndex: number | null };
  /** Invoice Review — dates/notes/terms + totals + Save. Behavior branches on `invoiceDraftStore.mode` ('create' | 'edit' | 'duplicate'). */
  InvoiceReview: undefined;
  InvoiceDetail: { invoiceId: string };
  /** Loads the invoice into `invoiceDraftStore` (`startEdit`) then forwards into `CreateInvoiceItems`. */
  EditInvoice: { invoiceId: string };
};
