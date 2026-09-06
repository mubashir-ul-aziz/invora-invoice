import type { Invoice } from '../types';
import { invoiceMatchesFilter, sortInvoices } from '../filtering';

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv_1',
    invoiceNumber: 'INV-1',
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2026-06-15',
    notes: null,
    terms: null,
    items: [
      {
        id: 'line_1',
        itemId: 'item_1',
        itemName: 'Widget',
        description: null,
        sku: null,
        quantity: 1,
        unit: null,
        weight: null,
        length: null,
        width: null,
        height: null,
        unitPrice: 100,
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

describe('invoiceMatchesFilter', () => {
  it('matches everything with an empty filter', () => {
    expect(invoiceMatchesFilter(makeInvoice(), 0, { searchText: '', status: 'all' })).toBe(true);
  });

  it('matches by invoice number, case-insensitively', () => {
    expect(invoiceMatchesFilter(makeInvoice(), 0, { searchText: 'inv-1', status: 'all' })).toBe(true);
    expect(invoiceMatchesFilter(makeInvoice(), 0, { searchText: 'inv-2', status: 'all' })).toBe(false);
  });

  it('matches by customer name', () => {
    expect(invoiceMatchesFilter(makeInvoice(), 0, { searchText: 'acme', status: 'all' })).toBe(true);
  });

  it('filters by computed status', () => {
    const invoice = makeInvoice({ dueDate: '2020-01-01' }); // long past due, unpaid
    expect(invoiceMatchesFilter(invoice, 0, { searchText: '', status: 'overdue' }, )).toBe(true);
    expect(invoiceMatchesFilter(invoice, 0, { searchText: '', status: 'unpaid' })).toBe(false);
    expect(invoiceMatchesFilter(invoice, 100, { searchText: '', status: 'paid' })).toBe(true);
  });

  it('filters by customerId when given', () => {
    const invoice = makeInvoice({ customerId: 'cust_9' });
    expect(invoiceMatchesFilter(invoice, 0, { searchText: '', status: 'all', customerId: 'cust_9' })).toBe(true);
    expect(invoiceMatchesFilter(invoice, 0, { searchText: '', status: 'all', customerId: 'cust_1' })).toBe(false);
  });
});

describe('sortInvoices', () => {
  it('sorts newest issue date first, without mutating the input', () => {
    const older = makeInvoice({ id: 'a', issueDate: '2026-01-01' });
    const newer = makeInvoice({ id: 'b', issueDate: '2026-06-01' });
    const input = [older, newer];
    const sorted = sortInvoices(input);
    expect(sorted.map((i) => i.id)).toEqual(['b', 'a']);
    expect(input).toEqual([older, newer]);
  });
});
