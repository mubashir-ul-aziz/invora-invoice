import {
  InvoiceLimitError,
  canAccessHistoricalInvoice,
  computeInvoiceUsage,
  createdAtToMs,
  decideInvoiceCreation,
  getInvoiceAccess,
  getUsagePeriod,
  mergeUsageCount,
  nextUsageLedger,
} from '../invoiceAccess';
import { FREE_INVOICE_ACCESS_WINDOW_MS, PLAN_CONFIG, PLAN_ORDER } from '../plans';

const HOUR = 3_600_000;

describe('getUsagePeriod', () => {
  it('is the local calendar month containing "now"', () => {
    const now = new Date(2026, 8, 22, 15, 30).getTime();
    const period = getUsagePeriod(now);
    expect(period.key).toBe('2026-09');
    expect(period.startMs).toBe(new Date(2026, 8, 1).getTime());
    expect(period.endMs).toBe(new Date(2026, 9, 1).getTime());
  });

  it('rolls over at the start of the next month and across the year boundary', () => {
    expect(getUsagePeriod(new Date(2026, 11, 31, 23, 59).getTime()).key).toBe('2026-12');
    const jan = getUsagePeriod(new Date(2027, 0, 1, 0, 0).getTime());
    expect(jan.key).toBe('2027-01');
    expect(jan.startMs).toBe(new Date(2027, 0, 1).getTime());
  });
});

describe('invoice limits per plan', () => {
  const period = getUsagePeriod(new Date(2026, 8, 10).getTime());

  it.each([
    ['free', 5],
    ['starter', 15],
    ['business', 40],
    ['pro', 100],
  ] as const)('%s allows up to %i invoices and blocks the next', (plan, limit) => {
    expect(decideInvoiceCreation(computeInvoiceUsage(plan, limit - 1, period)).allowed).toBe(true);
    const blocked = decideInvoiceCreation(computeInvoiceUsage(plan, limit, period));
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.reason).toBe('limit_reached');
      expect(blocked.usage.remaining).toBe(0);
    }
  });

  it('never blocks Unlimited', () => {
    const usage = computeInvoiceUsage('unlimited', 100_000, period);
    expect(usage.limit).toBeNull();
    expect(usage.remaining).toBeNull();
    expect(decideInvoiceCreation(usage).allowed).toBe(true);
  });

  it('exposes when the counter resets', () => {
    expect(computeInvoiceUsage('free', 1, period).resetsAt).toBe(new Date(2026, 9, 1).getTime());
  });

  it('carries the count in a typed error for the upgrade flow', () => {
    const error = new InvoiceLimitError(computeInvoiceUsage('free', 5, period));
    expect(error).toBeInstanceOf(Error);
    expect(error.usage.used).toBe(5);
    expect(error.message).toContain('5 of 5');
  });
});

describe('usage ledger (delete-to-reclaim protection)', () => {
  const period = getUsagePeriod(new Date(2026, 8, 10).getTime());

  it('counts the larger of rows and ledger, so deleting an invoice does not reclaim a slot', () => {
    const ledger = { periodKey: period.key, count: 5 };
    expect(mergeUsageCount(3, ledger, period)).toBe(5);
    expect(mergeUsageCount(6, ledger, period)).toBe(6);
  });

  it("ignores last month's ledger", () => {
    expect(mergeUsageCount(2, { periodKey: '2026-08', count: 9 }, period)).toBe(2);
  });

  it('advances by one per creation and restarts on a new month', () => {
    // rows passed in already include the invoice that was just created
    expect(nextUsageLedger(null, period, 1)).toEqual({ periodKey: '2026-09', count: 1 });
    expect(nextUsageLedger({ periodKey: '2026-09', count: 4 }, period, 5)).toEqual({
      periodKey: '2026-09',
      count: 5,
    });
    expect(nextUsageLedger({ periodKey: '2026-08', count: 9 }, period, 1)).toEqual({
      periodKey: '2026-09',
      count: 1,
    });
  });

  it('keeps counting creations even after deletions, and never lags the real rows', () => {
    // 5 created, one deleted (4 rows left), then a 6th created → 5 rows, but 6 creations.
    expect(nextUsageLedger({ periodKey: '2026-09', count: 5 }, period, 5)).toEqual({
      periodKey: '2026-09',
      count: 6,
    });
    // Invoices that predate the counter: 3 existing rows + 1 new.
    expect(nextUsageLedger(null, period, 4)).toEqual({ periodKey: '2026-09', count: 4 });
  });
});

describe('historical invoice access', () => {
  const createdAt = new Date(2026, 8, 1, 10, 0).getTime();

  it('gives Free users exactly 24 hours from createdAt', () => {
    expect(getInvoiceAccess('free', createdAt, createdAt).accessible).toBe(true);
    expect(getInvoiceAccess('free', createdAt, createdAt + 24 * HOUR - 1).accessible).toBe(true);
    expect(getInvoiceAccess('free', createdAt, createdAt + 24 * HOUR).accessible).toBe(false);
    expect(getInvoiceAccess('free', createdAt, createdAt + 30 * 24 * HOUR).accessible).toBe(false);
  });

  it('reports when a Free invoice stops being accessible', () => {
    expect(getInvoiceAccess('free', createdAt, createdAt + HOUR).accessEndsAt).toBe(
      createdAt + FREE_INVOICE_ACCESS_WINDOW_MS,
    );
    expect(getInvoiceAccess('free', createdAt, createdAt + 25 * HOUR).accessEndsAt).toBeNull();
  });

  it('never locks paid plans, however old the invoice', () => {
    for (const plan of PLAN_ORDER.filter((p) => PLAN_CONFIG[p].historicalInvoiceAccess)) {
      expect(canAccessHistoricalInvoice(plan, createdAt, createdAt + 5 * 365 * 24 * HOUR)).toBe(true);
    }
  });

  it('restores access as soon as a locked user is on a paid plan again (access control only)', () => {
    const late = createdAt + 10 * 24 * HOUR;
    expect(canAccessHistoricalInvoice('free', createdAt, late)).toBe(false);
    expect(canAccessHistoricalInvoice('starter', createdAt, late)).toBe(true);
  });

  it('parses ISO createdAt and treats garbage as old, not new', () => {
    expect(createdAtToMs('2026-09-01T10:00:00.000Z')).toBe(Date.parse('2026-09-01T10:00:00.000Z'));
    expect(createdAtToMs(123)).toBe(123);
    expect(createdAtToMs('not a date')).toBe(0);
    expect(canAccessHistoricalInvoice('free', createdAtToMs('not a date'), Date.now())).toBe(false);
  });
});
