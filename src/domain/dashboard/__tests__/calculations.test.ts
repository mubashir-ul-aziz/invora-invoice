import { summarizeDashboard } from '../calculations';
import { DEFAULT_RECENT_INVOICES_LIMIT, type DashboardInvoiceEntry } from '../types';

function entry(overrides: Partial<DashboardInvoiceEntry> & { invoiceId: string }): DashboardInvoiceEntry {
  return {
    invoiceNumber: `INV-${overrides.invoiceId}`,
    customerName: 'Acme Co',
    issueDate: '2026-01-01',
    dueDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    grandTotal: 100,
    amountPaid: 0,
    ...overrides,
  };
}

describe('summarizeDashboard', () => {
  it('returns all zeros and an empty recent list for no invoices', () => {
    expect(summarizeDashboard([])).toEqual({
      totalSales: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      totalOverdue: 0,
      invoiceCount: 0,
      recentInvoices: [],
    });
  });

  it('sums total sales, paid, and outstanding across every invoice', () => {
    const entries = [
      entry({ invoiceId: '1', grandTotal: 1000, amountPaid: 500 }),
      entry({ invoiceId: '2', grandTotal: 200, amountPaid: 200 }),
      entry({ invoiceId: '3', grandTotal: 300, amountPaid: 0 }),
    ];

    const summary = summarizeDashboard(entries, { today: '2026-01-01' });

    expect(summary.totalSales).toBe(1500);
    expect(summary.totalPaid).toBe(700);
    expect(summary.totalOutstanding).toBe(800); // 500 + 0 + 300
    expect(summary.invoiceCount).toBe(3);
  });

  it('floors an overpaid invoice at zero remaining instead of letting it cancel out another invoice’s outstanding balance', () => {
    const entries = [
      entry({ invoiceId: 'overpaid', grandTotal: 100, amountPaid: 300 }), // remaining would be -200 unfloored
      entry({ invoiceId: 'unpaid', grandTotal: 500, amountPaid: 0 }),
    ];

    const summary = summarizeDashboard(entries, { today: '2026-01-01' });

    // Naively: totalSales(600) - totalPaid(300) = 300. The correct, per-invoice
    // floored sum is 0 (overpaid) + 500 (unpaid) = 500 — never 300.
    expect(summary.totalOutstanding).toBe(500);
    expect(summary.totalPaid).toBe(300);
  });

  it('only counts overdue invoices toward totalOverdue, using each one’s own remaining balance', () => {
    const entries = [
      entry({ invoiceId: 'overdue-partial', grandTotal: 1000, amountPaid: 400, dueDate: '2025-01-01' }),
      entry({ invoiceId: 'overdue-unpaid', grandTotal: 200, amountPaid: 0, dueDate: '2025-06-01' }),
      entry({ invoiceId: 'not-yet-due', grandTotal: 300, amountPaid: 0, dueDate: '2099-01-01' }),
      entry({ invoiceId: 'paid-past-due', grandTotal: 150, amountPaid: 150, dueDate: '2025-01-01' }),
    ];

    const summary = summarizeDashboard(entries, { today: '2026-01-01' });

    expect(summary.totalOverdue).toBe(800); // 600 (overdue-partial remaining) + 200 (overdue-unpaid)
    // A fully-paid invoice is never "overdue" even past its due date (see computeInvoiceStatus).
    expect(summary.totalOutstanding).toBe(1100); // 600 + 200 + 300 + 0
  });

  it('orders recentInvoices newest issue date first, tiebreaking by createdAt, and caps at the given limit', () => {
    const entries = [
      entry({ invoiceId: 'a', issueDate: '2026-01-01', createdAt: '2026-01-01T10:00:00.000Z' }),
      entry({ invoiceId: 'b', issueDate: '2026-01-05', createdAt: '2026-01-05T10:00:00.000Z' }),
      entry({ invoiceId: 'c', issueDate: '2026-01-05', createdAt: '2026-01-05T12:00:00.000Z' }), // same day as b, created later
      entry({ invoiceId: 'd', issueDate: '2026-01-03', createdAt: '2026-01-03T10:00:00.000Z' }),
    ];

    const summary = summarizeDashboard(entries, { today: '2026-01-06', recentLimit: 3 });

    expect(summary.recentInvoices.map((r) => r.invoiceId)).toEqual(['c', 'b', 'd']);
    expect(summary.recentInvoices).toHaveLength(3);
  });

  it('defaults recentLimit to DEFAULT_RECENT_INVOICES_LIMIT', () => {
    const entries = Array.from({ length: DEFAULT_RECENT_INVOICES_LIMIT + 3 }, (_, i) =>
      entry({ invoiceId: String(i), issueDate: `2026-01-${String(i + 1).padStart(2, '0')}` }),
    );

    const summary = summarizeDashboard(entries, { today: '2026-02-01' });

    expect(summary.recentInvoices).toHaveLength(DEFAULT_RECENT_INVOICES_LIMIT);
    expect(summary.invoiceCount).toBe(entries.length); // count is never capped by the recent-list limit
  });

  it('each recent invoice carries its own computed status and numbers, not a re-derived total', () => {
    const entries = [entry({ invoiceId: 'x', grandTotal: 1000, amountPaid: 400 })];

    const summary = summarizeDashboard(entries, { today: '2026-01-01' });

    expect(summary.recentInvoices[0]).toEqual({
      invoiceId: 'x',
      invoiceNumber: 'INV-x',
      customerName: 'Acme Co',
      issueDate: '2026-01-01',
      grandTotal: 1000,
      amountPaid: 400,
      status: 'partial',
    });
  });
});
