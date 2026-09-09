import type { Customer } from '@/domain/customer/types';
import { EMPTY_INVOICE_ITEM_INPUT, type Invoice } from '@/domain/invoice/types';

import { useInvoiceDraftStore } from '../invoiceDraftStore';

const CUSTOMER: Customer = {
  id: 'cust_1',
  name: 'Acme Co',
  phone: null,
  email: null,
  website: null,
  address: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_1',
    invoiceNumber: 'INV-1',
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2026-06-15',
    notes: 'Thanks',
    terms: 'Net 15',
    items: [
      {
        id: 'line_1',
        itemId: 'item_1',
        itemName: 'Widget',
        description: null,
        sku: null,
        quantity: 2,
        unit: null,
        weight: null,
        length: null,
        width: null,
        height: null,
        unitPrice: 50,
        discountPercent: null,
        taxPercent: null,
        subtotal: 100,
        discountAmount: 0,
        taxAmount: 0,
        lineTotal: 100,
      },
    ],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  useInvoiceDraftStore.getState().reset();
});

describe('invoiceDraftStore', () => {
  it('startCreate resets to a blank draft with no customer yet', () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'weight', terms: 'Net 30' });
    const state = useInvoiceDraftStore.getState();
    expect(state.mode).toBe('create');
    expect(state.customer).toBeNull();
    expect(state.invoiceTypeId).toBe('weight');
    expect(state.terms).toBe('Net 30');
    expect(state.dueDate).toBeNull();
    expect(state.items).toEqual([]);
  });

  it('startCreate accepts a prefilled due date (from the business default payment terms)', () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general', dueDate: '2026-07-01' });
    expect(useInvoiceDraftStore.getState().dueDate).toBe('2026-07-01');
  });

  it('setCustomer, addLine, updateLine and removeLine mutate the draft', () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore.getState().setCustomer(CUSTOMER);
    expect(useInvoiceDraftStore.getState().customer).toEqual(CUSTOMER);

    const index = useInvoiceDraftStore.getState().addLine({ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget' });
    expect(index).toBe(0);
    expect(useInvoiceDraftStore.getState().items).toHaveLength(1);

    useInvoiceDraftStore.getState().updateLine(0, { ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget v2' });
    expect(useInvoiceDraftStore.getState().items[0].itemName).toBe('Widget v2');

    useInvoiceDraftStore.getState().removeLine(0);
    expect(useInvoiceDraftStore.getState().items).toHaveLength(0);
  });

  it('startEdit loads an existing invoice, fixing the customer and invoice type', () => {
    useInvoiceDraftStore.getState().startEdit(makeInvoice(), CUSTOMER);
    const state = useInvoiceDraftStore.getState();
    expect(state.mode).toBe('edit');
    expect(state.editingInvoiceId).toBe('inv_1');
    expect(state.customer).toEqual(CUSTOMER);
    expect(state.issueDate).toBe('2026-06-01');
    expect(state.dueDate).toBe('2026-06-15');
    expect(state.items).toHaveLength(1);
    // Snapshot's calculated fields are stripped back down to editable input.
    expect(state.items[0]).not.toHaveProperty('lineTotal');
    expect(state.items[0].itemName).toBe('Widget');
  });

  it('startDuplicate copies items/customer but resets dates and clears the editing id', () => {
    useInvoiceDraftStore.getState().startDuplicate(makeInvoice(), CUSTOMER);
    const state = useInvoiceDraftStore.getState();
    expect(state.mode).toBe('duplicate');
    expect(state.editingInvoiceId).toBeNull();
    expect(state.customer).toEqual(CUSTOMER);
    expect(state.dueDate).toBeNull();
    expect(state.items).toHaveLength(1);
    expect(state.notes).toBe('Thanks');
  });

  it('setDetails updates dates/notes/terms together', () => {
    useInvoiceDraftStore.getState().startCreate({ invoiceTypeId: 'general' });
    useInvoiceDraftStore
      .getState()
      .setDetails({ issueDate: '2026-08-01', dueDate: '2026-08-15', notes: 'n', terms: 't' });
    const state = useInvoiceDraftStore.getState();
    expect(state.issueDate).toBe('2026-08-01');
    expect(state.dueDate).toBe('2026-08-15');
    expect(state.notes).toBe('n');
    expect(state.terms).toBe('t');
  });
});
