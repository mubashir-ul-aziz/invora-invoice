import type { InvoiceTemplate } from '@/domain/business/types';
import type { InvoiceFieldConfig } from '@/domain/invoiceType/types';
import type { InvoicePaymentSummary } from '@/domain/payment/calculations';
import type { InvoiceItemSnapshot } from '@/domain/invoice/types';
import type { InvoiceTotals } from '@/domain/invoice/calculations';

export type { InvoiceTemplate };

/** The Business fields an invoice PDF actually shows — a narrow view over `BusinessProfile`, not a duplicate entity. */
export interface InvoicePdfBusiness {
  businessName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxId: string | null;
}

/** The Customer fields an invoice PDF actually shows — a narrow view over `Customer`. */
export interface InvoicePdfCustomer {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

/**
 * Everything one rendered invoice PDF needs, already assembled — see
 * `buildInvoicePdfData()`. Built from the invoice's own frozen
 * `InvoiceItemSnapshot[]` (never re-read from the live `Item`/`Customer`
 * catalog rows), per `MVP_BUILD_PLAN.md` §6.2's snapshot rule.
 */
export interface InvoicePdfData {
  template: InvoiceTemplate;
  business: InvoicePdfBusiness;
  /** Base64 `data:` URI for the logo, or null when there's no logo or it couldn't be read. Pre-resolved so rendering never depends on a `file://` path being reachable from the print engine. */
  logoDataUri: string | null;
  customer: InvoicePdfCustomer;
  invoiceNumber: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  issueDate: string;
  /** ISO calendar date, `YYYY-MM-DD`, or null. */
  dueDate: string | null;
  notes: string | null;
  terms: string | null;
  currency: string;
  /** Which columns apply to this invoice's line items (General/Quantity/Weight/Dimension/Custom) — see `resolveInvoiceFieldConfig`. Weight/Length/Width/Height columns are only rendered when they're part of this config, per the "when applicable" requirement. */
  fieldConfig: InvoiceFieldConfig;
  items: InvoiceItemSnapshot[];
  totals: InvoiceTotals;
  payment: InvoicePaymentSummary;
  /** e.g. "Paid" / "Partial" / "Unpaid" / "Overdue" — from `domain/invoice/status.ts`'s `INVOICE_STATUS_LABELS`. */
  statusLabel: string;
}
