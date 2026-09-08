import type { PaymentFormOutput } from './validation';
import type { Payment, PaymentUpdateInput } from './types';

/** Today as a local `YYYY-MM-DD` string — the default payment date for a new payment. Mirrors `domain/invoice/formMapping.ts`'s `todayIsoDate`. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Payment (or nothing, for "recording new") -> flat string-based form default
 * values. `remainingBalance`, when given, prefills the amount field with the
 * invoice's current remaining balance — a convenience for the common
 * "pay it off" case; the field stays freely editable for a partial payment.
 */
export function paymentToFormDefaults(payment: Payment | null, remainingBalance?: number) {
  return {
    amount: payment ? String(payment.amount) : remainingBalance != null && remainingBalance > 0 ? String(remainingBalance) : '',
    paymentDate: payment?.paymentDate ?? todayIsoDate(),
    method: payment?.method ?? 'cash',
    reference: payment?.reference ?? '',
    notes: payment?.notes ?? '',
  };
}

/** Validated flat form output -> the shape `PaymentRepository.update` expects. */
export function formValuesToPaymentUpdateInput(values: PaymentFormOutput): PaymentUpdateInput {
  return {
    amount: values.amount,
    paymentDate: values.paymentDate,
    method: values.method,
    reference: values.reference,
    notes: values.notes,
  };
}
