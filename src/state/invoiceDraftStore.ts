import { create } from 'zustand';

import type { Customer } from '@/domain/customer/types';
import { todayIsoDate } from '@/domain/invoice/formMapping';
import {
  invoiceItemInputFromSnapshot,
  type Invoice,
  type InvoiceItemInput,
} from '@/domain/invoice/types';
import type { InvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';

export type InvoiceDraftMode = 'create' | 'edit' | 'duplicate';

/**
 * Transient, in-progress invoice state shared across the Create Invoice
 * flow's screens (Customer → Items → Review) and Edit/Duplicate Invoice —
 * "app/UI state" per `MVP_BUILD_PLAN.md` §2 (Zustand), not domain data. The
 * local database remains the source of truth once `invoiceStore.create()`/
 * `update()` actually persists it; this store only exists so React
 * Navigation's separate screen components can share one draft without
 * threading it through route params.
 */
interface InvoiceDraftState {
  mode: InvoiceDraftMode | null;
  /** Set only in `'edit'` mode — which existing invoice `invoiceStore.update()` should target. */
  editingInvoiceId: string | null;
  customer: Customer | null;
  invoiceTypeId: InvoiceTypeId;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  terms: string | null;
  items: InvoiceItemInput[];

  /** Begins a brand-new invoice. The customer is set separately, once picked. `dueDate`, when given, prefills from the business's default payment terms. */
  startCreate: (params: { invoiceTypeId: InvoiceTypeId; terms?: string | null; dueDate?: string | null }) => void;
  /** Loads an existing invoice for editing — customer and invoice type are fixed (see `InvoiceUpdateInput`). */
  startEdit: (invoice: Invoice, customer: Customer | null) => void;
  /** Loads a copy of an existing invoice as the starting point for a brand-new one: fresh dates, a fresh number once saved. */
  startDuplicate: (invoice: Invoice, customer: Customer | null) => void;
  setCustomer: (customer: Customer) => void;
  setInvoiceType: (invoiceTypeId: InvoiceTypeId) => void;
  setDetails: (details: { issueDate: string; dueDate: string | null; notes: string | null; terms: string | null }) => void;
  /** Appends a line and returns its index, so the caller can navigate straight to editing it. */
  addLine: (line: InvoiceItemInput) => number;
  updateLine: (index: number, line: InvoiceItemInput) => void;
  removeLine: (index: number) => void;
  reset: () => void;
}

const INITIAL_STATE: Pick<
  InvoiceDraftState,
  'mode' | 'editingInvoiceId' | 'customer' | 'invoiceTypeId' | 'issueDate' | 'dueDate' | 'notes' | 'terms' | 'items'
> = {
  mode: null,
  editingInvoiceId: null,
  customer: null,
  invoiceTypeId: 'general',
  issueDate: todayIsoDate(),
  dueDate: null,
  notes: null,
  terms: null,
  items: [],
};

export const useInvoiceDraftStore = create<InvoiceDraftState>((set, get) => ({
  ...INITIAL_STATE,

  startCreate: ({ invoiceTypeId, terms, dueDate }) => {
    set({
      ...INITIAL_STATE,
      mode: 'create',
      invoiceTypeId,
      issueDate: todayIsoDate(),
      terms: terms ?? null,
      dueDate: dueDate ?? null,
    });
  },

  startEdit: (invoice, customer) => {
    set({
      mode: 'edit',
      editingInvoiceId: invoice.id,
      customer,
      invoiceTypeId: invoice.invoiceTypeId,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
      terms: invoice.terms,
      items: invoice.items.map(invoiceItemInputFromSnapshot),
    });
  },

  startDuplicate: (invoice, customer) => {
    set({
      mode: 'duplicate',
      editingInvoiceId: null,
      customer,
      invoiceTypeId: invoice.invoiceTypeId,
      issueDate: todayIsoDate(),
      dueDate: null,
      notes: invoice.notes,
      terms: invoice.terms,
      items: invoice.items.map(invoiceItemInputFromSnapshot),
    });
  },

  setCustomer: (customer) => set({ customer }),

  setInvoiceType: (invoiceTypeId) => set({ invoiceTypeId }),

  setDetails: ({ issueDate, dueDate, notes, terms }) => set({ issueDate, dueDate, notes, terms }),

  addLine: (line) => {
    const index = get().items.length;
    set((state) => ({ items: [...state.items, line] }));
    return index;
  },

  updateLine: (index, line) => {
    set((state) => ({
      items: state.items.map((existing, i) => (i === index ? line : existing)),
    }));
  },

  removeLine: (index) => {
    set((state) => ({ items: state.items.filter((_, i) => i !== index) }));
  },

  reset: () => set({ ...INITIAL_STATE, issueDate: todayIsoDate() }),
}));
