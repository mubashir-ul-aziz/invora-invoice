import { create } from 'zustand';

import type { BusinessRepository } from '@/data/business/BusinessRepository';
import { getBusinessRepository, getInvoiceRepository, getPaymentTotalsRepository } from '@/data/container';
import type { InvoiceRepository } from '@/data/invoice/InvoiceRepository';
import type { PaymentTotalsRepository } from '@/data/paymentTotals/PaymentTotalsRepository';
import { sumInvoiceTotals, type InvoiceTotals } from '@/domain/invoice/calculations';
import { computeInvoiceStatus } from '@/domain/invoice/status';
import {
  EMPTY_INVOICE_FILTER,
  type Invoice,
  type InvoiceFilter,
  type InvoiceInput,
  type InvoiceStatus,
  type InvoiceUpdateInput,
} from '@/domain/invoice/types';

export type InvoiceListStatus = 'idle' | 'loading' | 'ready' | 'error';

/** An invoice bundled with the numbers/derived status every screen needs — computed once here, never re-derived inside a widget. */
export interface InvoiceWithStatus {
  invoice: Invoice;
  amountPaid: number;
  status: InvoiceStatus;
  totals: InvoiceTotals;
}

interface InvoiceState {
  status: InvoiceListStatus;
  entries: InvoiceWithStatus[];
  filter: InvoiceFilter;
  error: string | null;
  /** Merges a partial filter change (search text, status, and/or customerId) and reloads. */
  setFilter: (patch: Partial<InvoiceFilter>) => Promise<void>;
  load: () => Promise<void>;
  getById: (id: string) => Promise<Invoice | null>;
  /** Same shape as a list entry, for the Invoice Detail screen. Null if the invoice no longer exists. */
  getDetail: (id: string) => Promise<InvoiceWithStatus | null>;
  /** Reserves the next invoice number, then creates the invoice — see `BusinessRepository.reserveNextInvoiceNumber()`. */
  create: (input: InvoiceInput) => Promise<Invoice>;
  update: (id: string, input: InvoiceUpdateInput) => Promise<Invoice>;
  remove: (id: string) => Promise<void>;
}

function withStatus(invoice: Invoice, amountPaid: number): InvoiceWithStatus {
  const totals = sumInvoiceTotals(invoice.items);
  const status = computeInvoiceStatus({ grandTotal: totals.grandTotal, amountPaid, dueDate: invoice.dueDate });
  return { invoice, amountPaid, status, totals };
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap the repositories via `createInvoiceStore` before anything touches the
 * database — same pattern as `itemStore`/`customerStore`.
 *
 * Status filtering happens here, not inside `InvoiceRepository` — the
 * repository has no knowledge of payments (see its interface doc comment),
 * so this store fetches the search/customer-filtered list, attaches each
 * invoice's real amount paid from `PaymentTotalsRepository`, computes status
 * via the centralized `computeInvoiceStatus`, and only then applies the
 * status half of the filter.
 */
export function createInvoiceStore(
  invoiceRepository: InvoiceRepository = getInvoiceRepository(),
  businessRepository: BusinessRepository = getBusinessRepository(),
  paymentTotalsRepository: PaymentTotalsRepository = getPaymentTotalsRepository(),
) {
  return create<InvoiceState>((set, get) => ({
    status: 'idle',
    entries: [],
    filter: EMPTY_INVOICE_FILTER,
    error: null,

    setFilter: async (patch) => {
      set((state) => ({ filter: { ...state.filter, ...patch } }));
      await get().load();
    },

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const filter = get().filter;
        const invoices = await invoiceRepository.list(filter);
        const amounts = await paymentTotalsRepository.getTotalPaidForInvoices(
          invoices.map((invoice) => invoice.id),
        );
        const entries = invoices
          .map((invoice) => withStatus(invoice, amounts[invoice.id] ?? 0))
          .filter((entry) => filter.status === 'all' || entry.status === filter.status);
        set({ entries, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    getById: async (id) => invoiceRepository.getById(id),

    getDetail: async (id) => {
      const invoice = await invoiceRepository.getById(id);
      if (!invoice) {
        return null;
      }
      const amountPaid = await paymentTotalsRepository.getTotalPaid(id);
      return withStatus(invoice, amountPaid);
    },

    create: async (input) => {
      const invoiceNumber = await businessRepository.reserveNextInvoiceNumber();
      const created = await invoiceRepository.create(invoiceNumber, input);
      await get().load();
      return created;
    },

    update: async (id, input) => {
      const updated = await invoiceRepository.update(id, input);
      await get().load();
      return updated;
    },

    remove: async (id) => {
      await invoiceRepository.delete(id);
      await get().load();
    },
  }));
}

/** App-wide singleton store, wired to the real (SQLite) repositories. */
export const useInvoiceStore = createInvoiceStore();
