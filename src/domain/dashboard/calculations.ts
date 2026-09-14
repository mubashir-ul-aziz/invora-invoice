/**
 * The **only** place dashboard arithmetic is implemented — per the brief's
 * explicit "create centralized dashboard calculation/query logic; do not use
 * hard-coded dashboard numbers" instruction, mirroring the same rule
 * `domain/invoice/calculations.ts` and `domain/payment/calculations.ts`
 * already follow. No screen sums invoices/payments itself: `DashboardScreen`
 * only ever renders a `DashboardSummary` this function produced.
 *
 * Every number here is derived from `DashboardInvoiceEntry[]` — each entry's
 * own `grandTotal`/`amountPaid` already came from the centralized invoice and
 * payment calculation modules (see the doc comment on `DashboardInvoiceEntry`),
 * so this function only ever *combines* already-computed numbers, exactly
 * like `sumInvoiceTotals`/`summarizeInvoicePayments` do at the invoice level.
 */
import { computeInvoiceStatus } from '@/domain/invoice/status';
import { remainingBalance } from '@/domain/payment/calculations';

import {
  DEFAULT_RECENT_INVOICES_LIMIT,
  EMPTY_DASHBOARD_SUMMARY,
  type DashboardInvoiceEntry,
  type DashboardSummary,
} from './types';

export interface SummarizeDashboardOptions {
  /** Injectable for tests; defaults to today (local ISO date) — see `domain/invoice/status.ts`. */
  today?: string;
  /** How many rows `recentInvoices` keeps — defaults to `DEFAULT_RECENT_INVOICES_LIMIT`. */
  recentLimit?: number;
}

/** Rounds to the nearest cent — every value this module produces goes through this once, at the point it's computed. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Turns every invoice's own numbers into the five dashboard figures plus the
 * recent-invoices list.
 *
 * `totalOutstanding`/`totalOverdue` are each a **sum of per-invoice remaining
 * balances** (every one individually floored at 0 via `remainingBalance`),
 * never `totalSales - totalPaid` computed globally — those two would only
 * agree if no invoice were ever overpaid. Per `MVP_BUILD_PLAN.md` §6.3,
 * overpayment is allowed (see `domain/payment/validation.ts`), and an
 * overpaid invoice's excess must never silently cancel out another invoice's
 * genuine outstanding balance.
 */
export function summarizeDashboard(
  entries: DashboardInvoiceEntry[],
  options: SummarizeDashboardOptions = {},
): DashboardSummary {
  if (entries.length === 0) {
    return { ...EMPTY_DASHBOARD_SUMMARY };
  }

  const recentLimit = options.recentLimit ?? DEFAULT_RECENT_INVOICES_LIMIT;

  let totalSales = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;

  const withStatus = entries.map((entry) => {
    const status = computeInvoiceStatus({
      grandTotal: entry.grandTotal,
      amountPaid: entry.amountPaid,
      dueDate: entry.dueDate,
      today: options.today,
    });
    const remaining = remainingBalance(entry.grandTotal, entry.amountPaid);

    totalSales = round2(totalSales + entry.grandTotal);
    totalPaid = round2(totalPaid + entry.amountPaid);
    totalOutstanding = round2(totalOutstanding + remaining);
    if (status === 'overdue') {
      totalOverdue = round2(totalOverdue + remaining);
      overdueCount += 1;
    } else if (status === 'paid') {
      paidCount += 1;
    } else {
      pendingCount += 1;
    }

    return { entry, status };
  });

  const recentInvoices = [...withStatus]
    .sort((a, b) => {
      const byIssueDate = b.entry.issueDate.localeCompare(a.entry.issueDate);
      return byIssueDate !== 0 ? byIssueDate : b.entry.createdAt.localeCompare(a.entry.createdAt);
    })
    .slice(0, recentLimit)
    .map(({ entry, status }) => ({
      invoiceId: entry.invoiceId,
      invoiceNumber: entry.invoiceNumber,
      customerName: entry.customerName,
      issueDate: entry.issueDate,
      dueDate: entry.dueDate,
      grandTotal: entry.grandTotal,
      amountPaid: entry.amountPaid,
      status,
    }));

  return {
    totalSales,
    totalPaid,
    totalOutstanding,
    totalOverdue,
    invoiceCount: entries.length,
    paidCount,
    pendingCount,
    overdueCount,
    recentInvoices,
  };
}
