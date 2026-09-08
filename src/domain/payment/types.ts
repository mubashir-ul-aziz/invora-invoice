/**
 * `Payment` (Phase 7) is a **separate, additive record** against one invoice
 * — never a single mutable `amountPaid` field on `Invoice`. Per
 * `MVP_BUILD_PLAN.md` §6.3:
 *
 *   Invoice = $1,000. Payment 1 = $300. Payment 2 = $200.
 *   Paid = $500. Remaining = $500.
 *
 * `invoiceId` is fixed at creation (a payment can't be moved to a different
 * invoice — the correction path is deleting it and recording a new one,
 * mirroring how `Invoice.customerId` is fixed once an invoice exists).
 * `invoiceNumber`/`customerId`/`customerName` are light, additive snapshots
 * (the same reasoning `Invoice.customerName` already applies) so Payment
 * History can render a readable row without joining back through
 * `InvoiceRepository`/`CustomerRepository` for every row.
 */
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'paypal' | 'other';

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  paypal: 'PayPal',
  other: 'Other',
};

export interface Payment {
  id: string;
  invoiceId: string;
  /** Snapshot of the invoice's number at the time this payment was recorded. */
  invoiceNumber: string;
  customerId: string;
  /** Snapshot of the customer's name at the time this payment was recorded. */
  customerName: string;
  amount: number;
  /** ISO calendar date, `YYYY-MM-DD`. */
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields the Record Payment screen collects; id/timestamps are repository-managed. */
export type PaymentInput = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>;

/** What Edit Payment is allowed to change — `invoiceId`/customer snapshot are fixed at creation, see the module doc comment. */
export type PaymentUpdateInput = Pick<Payment, 'amount' | 'paymentDate' | 'method' | 'reference' | 'notes'>;

/** Search + filter criteria for the Payment History screen. */
export interface PaymentFilter {
  /** Matched against invoice number, customer name, and reference (case-insensitive substring). */
  searchText: string;
  /** `'all'` (default) means no method filter applied. */
  method: PaymentMethod | 'all';
  /** When set, restricts the list to one customer's payments (used by Customer History). */
  customerId?: string;
  /** When set, restricts the list to one invoice's payments (used by Invoice Detail's payment summary). */
  invoiceId?: string;
}

export const EMPTY_PAYMENT_FILTER: PaymentFilter = { searchText: '', method: 'all' };

export const PAYMENT_METHOD_FILTER_OPTIONS: { value: PaymentMethod | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...PAYMENT_METHOD_OPTIONS,
];
