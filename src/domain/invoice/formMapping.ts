import type { FieldKey } from '@/domain/invoiceType/fieldCatalog';
import type { InvoiceFieldConfig } from '@/domain/invoiceType/types';

import type { InvoiceDetailsFormOutput, InvoiceLineFormOutput } from './validation';
import { EMPTY_INVOICE_ITEM_INPUT, type Invoice, type InvoiceItemInput } from './types';

function has(fieldConfig: InvoiceFieldConfig, key: FieldKey): boolean {
  return fieldConfig.fields.some((field) => field.key === key);
}

/** Line (or nothing, for "adding a new one") -> flat string-based form default values. */
export function invoiceLineToFormDefaults(line: InvoiceItemInput | null) {
  const input = line ?? EMPTY_INVOICE_ITEM_INPUT;
  return {
    itemName: input.itemName,
    description: input.description ?? '',
    sku: input.sku ?? '',
    quantity: input.quantity != null ? String(input.quantity) : '',
    unit: input.unit ?? '',
    weight: input.weight != null ? String(input.weight) : '',
    weightUnit: input.weightUnit ?? '',
    length: input.length != null ? String(input.length) : '',
    width: input.width != null ? String(input.width) : '',
    height: input.height != null ? String(input.height) : '',
    lengthUnit: input.lengthUnit ?? '',
    timeUnit: input.timeUnit ?? '',
    unitPrice: String(input.unitPrice ?? 0),
    discountPercent: input.discountPercent != null ? String(input.discountPercent) : '',
    taxPercent: input.taxPercent != null ? String(input.taxPercent) : '',
  };
}

/**
 * Validated flat form output -> the shape the draft store expects.
 * `itemId` isn't a form field (it's fixed once a line is created from a
 * catalog item, or null for a manual line) so it's threaded through
 * separately rather than editable; `fieldConfig` nulls out any field that
 * isn't part of the invoice's resolved field set, so a value typed before
 * switching a field off can never linger in storage.
 */
export function formValuesToInvoiceLineInput(
  values: InvoiceLineFormOutput,
  itemId: string | null,
  fieldConfig: InvoiceFieldConfig,
): InvoiceItemInput {
  return {
    itemId,
    pricingMethodId: fieldConfig.invoiceTypeId,
    itemName: values.itemName,
    description: has(fieldConfig, 'description') ? values.description : null,
    sku: has(fieldConfig, 'sku') ? values.sku : null,
    quantity: has(fieldConfig, 'quantity') ? (values.quantity ?? 1) : null,
    unit: has(fieldConfig, 'unit') ? values.unit : null,
    weight: has(fieldConfig, 'weight') ? values.weight : null,
    weightUnit: has(fieldConfig, 'weightUnit') ? values.weightUnit : null,
    length: has(fieldConfig, 'length') ? values.length : null,
    width: has(fieldConfig, 'width') ? values.width : null,
    height: has(fieldConfig, 'height') ? values.height : null,
    lengthUnit: has(fieldConfig, 'lengthUnit') ? values.lengthUnit : null,
    timeUnit: has(fieldConfig, 'timeUnit') ? values.timeUnit : null,
    unitPrice: values.unitPrice,
    discountPercent: has(fieldConfig, 'discount') ? (values.discountPercent ?? 0) : null,
    taxPercent: has(fieldConfig, 'tax') ? values.taxPercent : null,
  };
}

/** Today as a local `YYYY-MM-DD` string — the default issue date for a new invoice. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Adds `days` to an ISO calendar date — used to prefill a new invoice's due date from the business's default payment terms (Phase 2). */
export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Invoice (or nothing, for "creating new") -> flat string-based form default values for the Review step. */
export function invoiceToDetailsFormDefaults(invoice: Pick<Invoice, 'issueDate' | 'dueDate' | 'notes' | 'terms'> | null) {
  return {
    issueDate: invoice?.issueDate ?? todayIsoDate(),
    dueDate: invoice?.dueDate ?? '',
    notes: invoice?.notes ?? '',
    terms: invoice?.terms ?? '',
  };
}

export function formValuesToInvoiceDetails(values: InvoiceDetailsFormOutput) {
  return {
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    notes: values.notes,
    terms: values.terms,
  };
}
