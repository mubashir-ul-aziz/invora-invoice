/**
 * `Customer` is a contact record only — name, phone, email, address, notes.
 *
 * It intentionally has **no stored balance/outstanding/overdue field**. Per
 * `MVP_BUILD_PLAN.md` §6.3, a customer's financial position must always be
 * *calculated* from the full set of invoices and payments, never cached as a
 * single mutable number that can drift out of sync. See
 * `CustomerBalanceSummary` and `data/customerActivity/CustomerActivityRepository.ts`
 * for how that calculation is abstracted — this type stays clean so nothing
 * here ever needs a breaking shape-change once Invoices (Phase 6) and
 * Payments (Phase 7) exist.
 */
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields the Create/Edit Customer screens collect; id/timestamps are repository-managed. */
export type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

export const EMPTY_CUSTOMER_INPUT: CustomerInput = {
  name: '',
  phone: null,
  email: null,
  address: null,
  notes: null,
};

/** Search criteria for the Customer List screen. */
export interface CustomerFilter {
  /** Matched against name, phone, and email (case-insensitive substring). */
  searchText: string;
}

export const EMPTY_CUSTOMER_FILTER: CustomerFilter = { searchText: '' };

/**
 * The numbers shown on Customer Detail. Always *derived* from invoices and
 * payments (see `CustomerActivityRepository`) — never a stored column on
 * `Customer`, and never persisted anywhere by this module.
 */
export interface CustomerBalanceSummary {
  /** Sum of every invoice issued to this customer. */
  totalBilled: number;
  /** Sum of every payment recorded against this customer's invoices. */
  totalPaid: number;
  /** `totalBilled - totalPaid`, floored at 0. */
  outstanding: number;
  /** The portion of `outstanding` that belongs to invoices past their due date. */
  overdueAmount: number;
  invoiceCount: number;
}

export const EMPTY_CUSTOMER_BALANCE_SUMMARY: CustomerBalanceSummary = {
  totalBilled: 0,
  totalPaid: 0,
  outstanding: 0,
  overdueAmount: 0,
  invoiceCount: 0,
};

export type CustomerActivityType = 'invoice' | 'payment';

/**
 * One chronological row on Customer History — either an invoice or a
 * payment. Until Phase 6 (Invoices) and Phase 7 (Payments) exist, nothing
 * produces real entries of this shape yet (see
 * `data/customerActivity/NullCustomerActivityRepository.ts`); this type is
 * defined now so those phases plug into the same Customer Detail/History
 * screens without a redesign.
 */
export interface CustomerActivityEntry {
  id: string;
  type: CustomerActivityType;
  /** ISO timestamp — the invoice's issue date, or the payment's recorded date. */
  date: string;
  /** e.g. "Invoice INV-1002" or "Payment via Cash". */
  title: string;
  amount: number;
  /** Invoice status (paid/partial/unpaid/overdue) or payment method label; null when not applicable. */
  status: string | null;
}

/** Filter for the Customer History screen. */
export interface CustomerActivityFilter {
  type: CustomerActivityType | 'all';
}

export const EMPTY_CUSTOMER_ACTIVITY_FILTER: CustomerActivityFilter = { type: 'all' };
