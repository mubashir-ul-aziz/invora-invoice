import {
  EMPTY_CUSTOMER_BALANCE_SUMMARY,
  type CustomerActivityEntry,
  type CustomerActivityFilter,
  type CustomerBalanceSummary,
} from './types';

/** A customer's billing status, derived from their `CustomerBalanceSummary` — feeds the Customer List screen's per-row badge and its Due/Settled filter pills. */
export type CustomerBalanceStatus = 'settled' | 'overdue' | 'due';

/**
 * `outstanding === 0` is settled; any overdue portion takes priority over a
 * merely-not-yet-due balance. Never reads a stored status field — always
 * derived from the same `CustomerBalanceSummary` `summarizeActivity()`
 * produces, per `MVP_BUILD_PLAN.md` §6.3.
 */
export function classifyBalanceStatus(summary: CustomerBalanceSummary): CustomerBalanceStatus {
  if (summary.outstanding <= 0) {
    return 'settled';
  }
  return summary.overdueAmount > 0 ? 'overdue' : 'due';
}

/**
 * Derives the Customer Detail summary numbers from a customer's raw
 * chronological activity — the one calculation both
 * `InMemoryCustomerActivityRepository` (today's mock/testing data) and a
 * future real implementation (Phase 6/7, once `Invoice`/`Payment` repositories
 * exist) are meant to share, so "what counts as outstanding/overdue" is never
 * defined twice. Per `MVP_BUILD_PLAN.md` §6.3, this is always a calculation
 * over entries — nothing here reads or writes a stored balance field.
 */
export function summarizeActivity(entries: CustomerActivityEntry[]): CustomerBalanceSummary {
  const invoices = entries.filter((entry) => entry.type === 'invoice');
  const payments = entries.filter((entry) => entry.type === 'payment');

  const totalBilled = round2(invoices.reduce((sum, entry) => sum + entry.amount, 0));
  const totalPaid = round2(payments.reduce((sum, entry) => sum + entry.amount, 0));
  const overdueAmount = round2(
    invoices.filter((entry) => entry.status === 'overdue').reduce((sum, entry) => sum + entry.amount, 0),
  );

  return {
    totalBilled,
    totalPaid,
    outstanding: Math.max(0, round2(totalBilled - totalPaid)),
    overdueAmount,
    invoiceCount: invoices.length,
  };
}

/** Newest first — the order the Customer History screen displays entries in. */
export function sortActivityChronological(entries: CustomerActivityEntry[]): CustomerActivityEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

/** `filter.type === 'all'` (the default) returns every entry unchanged. */
export function filterActivity(
  entries: CustomerActivityEntry[],
  filter: CustomerActivityFilter,
): CustomerActivityEntry[] {
  if (filter.type === 'all') {
    return entries;
  }
  return entries.filter((entry) => entry.type === filter.type);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export { EMPTY_CUSTOMER_BALANCE_SUMMARY };
