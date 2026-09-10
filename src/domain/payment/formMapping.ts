import type { PaymentFormOutput } from './validation';
import type { Payment, PaymentUpdateInput } from './types';

/** Today as a local `YYYY-MM-DD` string — the default payment date for a new payment. Mirrors `domain/invoice/formMapping.ts`'s `todayIsoDate`. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Payment (or nothing, for "recording new") -> flat string-based form default
 * values. Recording a new payment always starts with a blank amount field —
 * it's never prefilled from the invoice's remaining balance — so the payer
 * has to type the actual amount rather than accidentally submit the full
 * balance.
 */
export function paymentToFormDefaults(payment: Payment | null) {
  return {
    amount: payment ? String(payment.amount) : '',
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
