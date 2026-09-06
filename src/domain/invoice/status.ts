import type { InvoiceStatus } from './types';

export interface InvoiceStatusInput {
  grandTotal: number;
  /** Sum of every payment recorded against this invoice — 0 until Phase 7 (Payments) exists; see `data/paymentTotals/`. */
  amountPaid: number;
  /** ISO calendar date, `YYYY-MM-DD`, or null = no due date set. */
  dueDate: string | null;
  /** Injectable for tests; defaults to today (local ISO date). */
  today?: string;
}

/**
 * Derives paid/partial/unpaid/overdue exactly once, from an invoice's total,
 * due date, and amount paid — never a stored column (see the doc comment on
 * `Invoice` in `types.ts` and `MVP_BUILD_PLAN.md` §6.3/§6.5). A fully-paid
 * invoice is "paid" even past its due date; a partially- or un-paid invoice
 * past its due date is "overdue" rather than "partial"/"unpaid", since
 * overdue is the more actionable state to surface.
 */
export function computeInvoiceStatus(input: InvoiceStatusInput): InvoiceStatus {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const amountPaid = Math.max(0, input.amountPaid);

  if (input.grandTotal > 0 && amountPaid >= input.grandTotal) {
    return 'paid';
  }
  if (input.dueDate && input.dueDate < today) {
    return 'overdue';
  }
  if (amountPaid > 0) {
    return 'partial';
  }
  return 'unpaid';
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
};

export const INVOICE_STATUS_OPTIONS: { value: InvoiceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];
