import type { InvoiceStatus } from '@/domain/invoice/types';

/**
 * One invoice's numbers, as needed to compute every dashboard metric — never
 * a full `Invoice` (with its line items) or a customer's raw `Payment[]`.
 * `data/dashboard/DashboardRepository.ts` is deliberately narrower than
 * `InvoiceRepository`/`PaymentRepository` for exactly this reason: the
 * dashboard needs one row per invoice, not one row per line item or payment,
 * so it stays fast as the number of invoices grows — see
 * `SqliteDashboardRepository`'s doc comment for how that's achieved.
 */
export interface DashboardInvoiceEntry {
  invoiceId: string;
  invoiceNumber: string;
  /** Snapshot of the customer's name, same reasoning as `Invoice.customerName`. */
  customerName: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  issueDate: string;
  /** ISO calendar date, `YYYY-MM-DD`, or null = no due date set. */
  dueDate: string | null;
  /** ISO timestamp — the tiebreaker `recentInvoices` uses for same-day invoices, mirroring `domain/invoice/filtering.ts`'s `sortInvoices`. */
  createdAt: string;
  /** This invoice's own grand total — already summed once via `domain/invoice/calculations.ts`, never recomputed here. */
  grandTotal: number;
  /** This invoice's own total paid — already summed once via `domain/payment/calculations.ts`, never recomputed here. */
  amountPaid: number;
}

/** One row in the dashboard's "Recent invoices" list — display-ready, already carrying its derived status. */
export interface DashboardRecentInvoice {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  grandTotal: number;
  amountPaid: number;
  status: InvoiceStatus;
}

/**
 * Every number the Dashboard screen shows. Per `MVP_BUILD_PLAN.md`'s Phase 8
 * scope, deliberately just these five figures plus a short recent-invoices
 * list — no charts, no trends, no accounting analytics.
 */
export interface DashboardSummary {
  /** Sum of every invoice's grand total — every invoice ever issued, not just unpaid ones. */
  totalSales: number;
  /** Sum of every invoice's amount paid (real `Payment` rows — see `domain/payment/calculations.ts`). */
  totalPaid: number;
  /** Sum of every invoice's remaining balance, each floored at 0 — never a raw `totalSales - totalPaid` (see the doc comment on `summarizeDashboard`). */
  totalOutstanding: number;
  /** Sum of the remaining balance of invoices whose computed status is `'overdue'` only. */
  totalOverdue: number;
  /** Count of every invoice, regardless of status. */
  invoiceCount: number;
  /** Newest-issue-date-first, capped at the configured limit — see `DEFAULT_RECENT_INVOICES_LIMIT`. */
  recentInvoices: DashboardRecentInvoice[];
}

/** How many rows `recentInvoices` keeps by default — a short glanceable list, not a paginated history (that's Invoice List/Payment History's job). */
export const DEFAULT_RECENT_INVOICES_LIMIT = 5;

export const EMPTY_DASHBOARD_SUMMARY: DashboardSummary = {
  totalSales: 0,
  totalPaid: 0,
  totalOutstanding: 0,
  totalOverdue: 0,
  invoiceCount: 0,
  recentInvoices: [],
};
