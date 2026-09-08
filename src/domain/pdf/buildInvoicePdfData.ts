import type { BusinessProfile, InvoiceTemplate } from '@/domain/business/types';
import type { Customer } from '@/domain/customer/types';
import type { InvoiceTotals } from '@/domain/invoice/calculations';
import type { Invoice } from '@/domain/invoice/types';
import { INVOICE_STATUS_LABELS } from '@/domain/invoice/status';
import type { InvoiceStatus } from '@/domain/invoice/types';
import type { InvoiceFieldConfig } from '@/domain/invoiceType/types';
import { summarizeInvoicePayments } from '@/domain/payment/calculations';
import type { Payment } from '@/domain/payment/types';

import type { InvoicePdfData } from './types';

export interface BuildInvoicePdfDataArgs {
  template: InvoiceTemplate;
  invoice: Invoice;
  totals: InvoiceTotals;
  status: InvoiceStatus;
  /** Every payment recorded against this invoice — summed here via the centralized `summarizeInvoicePayments`, never re-derived. */
  payments: Payment[];
  /** Null when the business profile hasn't been set up yet — every field renders blank rather than the screen failing to build a PDF at all. */
  business: BusinessProfile | null;
  /** Null when the customer contact was since deleted — falls back to the invoice's own name snapshot (see `customerFromInvoiceSnapshot` precedent in `InvoiceDetailScreen`). */
  customer: Customer | null;
  fieldConfig: InvoiceFieldConfig;
  /** Pre-resolved via `resolveLogoDataUri()` — null when there's no logo or it couldn't be read (offline-safe: never blocks PDF generation). */
  logoDataUri: string | null;
}

/**
 * The one place an `InvoicePdfData` bundle is assembled — a pure function so
 * every template-rendering path (and its tests) works from the exact same
 * data shape, and so template rendering itself never has to reach back into
 * a repository. Per `MVP_BUILD_PLAN.md`'s snapshot rule, `invoice.items` (the
 * frozen `InvoiceItemSnapshot[]`) is used as-is — this never re-reads the
 * live `Item` catalog.
 */
export function buildInvoicePdfData(args: BuildInvoicePdfDataArgs): InvoicePdfData {
  const { invoice, business, customer } = args;

  return {
    template: args.template,
    business: {
      businessName: business?.businessName || 'Your Business',
      address: business?.address ?? null,
      phone: business?.phone ?? null,
      email: business?.email ?? null,
      website: business?.website ?? null,
      taxId: business?.taxId ?? null,
    },
    logoDataUri: args.logoDataUri,
    customer: {
      name: customer?.name || invoice.customerName,
      phone: customer?.phone ?? null,
      email: customer?.email ?? null,
      address: customer?.address ?? null,
    },
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    terms: invoice.terms,
    currency: business?.currency || 'USD',
    fieldConfig: args.fieldConfig,
    items: invoice.items,
    totals: args.totals,
    payment: summarizeInvoicePayments(args.totals.grandTotal, args.payments),
    statusLabel: INVOICE_STATUS_LABELS[args.status],
  };
}
