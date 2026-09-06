import { computeInvoiceStatus } from '../status';

const TODAY = '2026-06-15';

describe('computeInvoiceStatus', () => {
  it('is unpaid when nothing has been paid and there is no due date, or it is not yet due', () => {
    expect(computeInvoiceStatus({ grandTotal: 100, amountPaid: 0, dueDate: null, today: TODAY })).toBe('unpaid');
    expect(computeInvoiceStatus({ grandTotal: 100, amountPaid: 0, dueDate: '2026-06-30', today: TODAY })).toBe(
      'unpaid',
    );
  });

  it('is overdue once the due date has passed and it is not fully paid', () => {
    expect(computeInvoiceStatus({ grandTotal: 100, amountPaid: 0, dueDate: '2026-06-01', today: TODAY })).toBe(
      'overdue',
    );
    expect(computeInvoiceStatus({ grandTotal: 100, amountPaid: 40, dueDate: '2026-06-01', today: TODAY })).toBe(
      'overdue',
    );
  });

  it('is partial once something has been paid but not overdue and not fully paid', () => {
    expect(computeInvoiceStatus({ grandTotal: 100, amountPaid: 40, dueDate: '2026-06-30', today: TODAY })).toBe(
      'partial',
    );
  });

  it('is paid once the amount paid meets or exceeds the grand total, even past the due date', () => {
    expect(computeInvoiceStatus({ grandTotal: 100, amountPaid: 100, dueDate: '2026-06-01', today: TODAY })).toBe(
      'paid',
    );
    expect(computeInvoiceStatus({ grandTotal: 100, amountPaid: 150, dueDate: null, today: TODAY })).toBe('paid');
  });

  it('defaults to today when not given, and never lets a negative amountPaid produce a false "partial"', () => {
    expect(computeInvoiceStatus({ grandTotal: 100, amountPaid: -5, dueDate: null })).toBe('unpaid');
  });
});
