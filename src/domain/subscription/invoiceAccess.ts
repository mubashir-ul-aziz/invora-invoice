import { FREE_INVOICE_ACCESS_WINDOW_MS, getPlanConfig, type PlanId } from './plans';
import type { UsageLedger } from './types';

/**
 * Pure invoice access rules. Nothing here reads a database, a clock or a
 * store — callers pass in the plan, the counts and "now" — so every rule is
 * unit-testable and the same rule is used by every screen.
 */

// ---------------------------------------------------------------------------
// Usage period
// ---------------------------------------------------------------------------

export interface UsagePeriod {
  /** `YYYY-MM` (local time) — also the key the usage ledger is stored under. */
  key: string;
  /** Inclusive start, epoch ms. */
  startMs: number;
  /** Exclusive end (the start of the next period), epoch ms. */
  endMs: number;
}

/**
 * Invoices are metered per **local calendar month**. There is no billing-cycle
 * anchor to use instead: Free has no billing cycle, and a subscription's
 * renewal date says nothing reliable about invoices created while offline or
 * before subscribing.
 */
export function getUsagePeriod(nowMs: number): UsagePeriod {
  const now = new Date(nowMs);
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    startMs: new Date(year, month, 1).getTime(),
    endMs: new Date(year, month + 1, 1).getTime(),
  };
}

/**
 * The invoices used this period. Counting invoice rows alone would let a
 * user delete an invoice to reclaim a slot, so the count is the larger of
 * the rows created this period and a monotonic counter incremented on every
 * successful creation (`nextUsageLedger`). Restoring a backup can raise the
 * row count but never lowers the counter.
 */
export function mergeUsageCount(
  rowsCreatedThisPeriod: number,
  ledger: UsageLedger | null,
  period: UsagePeriod,
): number {
  const ledgerCount = ledger && ledger.periodKey === period.key ? ledger.count : 0;
  return Math.max(rowsCreatedThisPeriod, ledgerCount);
}

/**
 * The ledger after an invoice was just created (rolling over when the month
 * changed). `rowsCreatedThisPeriod` must already include the new invoice: the
 * counter advances by one from where it was, but never falls behind the rows
 * that actually exist (e.g. invoices that predate the counter, or a restored backup).
 */
export function nextUsageLedger(
  ledger: UsageLedger | null,
  period: UsagePeriod,
  rowsCreatedThisPeriod: number,
): UsageLedger {
  const previous = ledger && ledger.periodKey === period.key ? ledger.count : 0;
  return { periodKey: period.key, count: Math.max(rowsCreatedThisPeriod, previous + 1) };
}

// ---------------------------------------------------------------------------
// Creation limit
// ---------------------------------------------------------------------------

export interface InvoiceUsage {
  plan: PlanId;
  used: number;
  /** `null` = unlimited. */
  limit: number | null;
  /** `null` = unlimited. */
  remaining: number | null;
  periodKey: string;
  /** When the counter resets (start of next month), epoch ms. */
  resetsAt: number;
}

export function computeInvoiceUsage(plan: PlanId, used: number, period: UsagePeriod): InvoiceUsage {
  const limit = getPlanConfig(plan).monthlyInvoiceLimit;
  return {
    plan,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    periodKey: period.key,
    resetsAt: period.endMs,
  };
}

export type InvoiceCreationDecision =
  | { allowed: true; usage: InvoiceUsage }
  | { allowed: false; reason: 'limit_reached'; usage: InvoiceUsage };

export function decideInvoiceCreation(usage: InvoiceUsage): InvoiceCreationDecision {
  if (usage.limit === null || usage.used < usage.limit) {
    return { allowed: true, usage };
  }
  return { allowed: false, reason: 'limit_reached', usage };
}

/** Thrown by the creation gate so callers can send the user to the upgrade screen. */
export class InvoiceLimitError extends Error {
  readonly usage: InvoiceUsage;

  constructor(usage: InvoiceUsage) {
    super(
      usage.limit === null
        ? 'Invoice limit reached.'
        : `You've used ${usage.used} of ${usage.limit} invoices this month.`,
    );
    this.name = 'InvoiceLimitError';
    this.usage = usage;
  }
}

// ---------------------------------------------------------------------------
// Historical access
// ---------------------------------------------------------------------------

export interface InvoiceAccess {
  accessible: boolean;
  /**
   * For a Free user's still-accessible invoice: when access ends (epoch ms).
   * Null once locked, or when the plan has full historical access.
   */
  accessEndsAt: number | null;
}

/**
 * Whether `plan` may open an invoice created at `createdAtMs`.
 *
 * Paid plans: always. Free: for `FREE_INVOICE_ACCESS_WINDOW_MS` after
 * `createdAt`. This is access control only — the invoice is never modified
 * or deleted, and access returns the moment the user is on a paid plan again.
 * `nowMs` should already be `effectiveNow(...)` so a rolled-back device clock
 * doesn't reopen locked invoices.
 */
export function getInvoiceAccess(plan: PlanId, createdAtMs: number, nowMs: number): InvoiceAccess {
  if (getPlanConfig(plan).historicalInvoiceAccess) {
    return { accessible: true, accessEndsAt: null };
  }
  const endsAt = createdAtMs + FREE_INVOICE_ACCESS_WINDOW_MS;
  return nowMs < endsAt ? { accessible: true, accessEndsAt: endsAt } : { accessible: false, accessEndsAt: null };
}

export function canAccessHistoricalInvoice(plan: PlanId, createdAtMs: number, nowMs: number): boolean {
  return getInvoiceAccess(plan, createdAtMs, nowMs).accessible;
}

/** Parses an `Invoice.createdAt` ISO string; an unparseable value is treated as "old" (locked on Free) rather than "new". */
export function createdAtToMs(createdAt: string | number): number {
  if (typeof createdAt === 'number') return createdAt;
  const ms = Date.parse(createdAt);
  return Number.isNaN(ms) ? 0 : ms;
}
