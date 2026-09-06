import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';

import { InMemoryInvoiceRepository } from '../InMemoryInvoiceRepository';

function makeInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2026-06-15',
    notes: null,
    terms: null,
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 10 }],
    ...overrides,
  };
}

describe('InMemoryInvoiceRepository', () => {
  it('starts with an empty list', async () => {
    const repo = new InMemoryInvoiceRepository();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('creates an invoice with the given (pre-reserved) number and computes line totals', async () => {
    const repo = new InMemoryInvoiceRepository();
    const created = await repo.create('INV-1', makeInput());

    expect(created.id).toBeTruthy();
    expect(created.invoiceNumber).toBe('INV-1');
    expect(created.items).toHaveLength(1);
    expect(created.items[0].lineTotal).toBe(20);
    expect(created.createdAt).toBe(created.updatedAt);
  });

  it('assigns each line its own id, independent of insertion order', async () => {
    const repo = new InMemoryInvoiceRepository();
    const created = await repo.create(
      'INV-1',
      makeInput({
        items: [
          { ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'A', unitPrice: 5 },
          { ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'B', unitPrice: 10 },
        ],
      }),
    );
    expect(created.items[0].id).not.toBe(created.items[1].id);
  });

  it('getById returns null for an unknown id', async () => {
    const repo = new InMemoryInvoiceRepository();
    await expect(repo.getById('missing')).resolves.toBeNull();
  });

  it('getById finds a created invoice', async () => {
    const repo = new InMemoryInvoiceRepository();
    const created = await repo.create('INV-1', makeInput());
    await expect(repo.getById(created.id)).resolves.toEqual(created);
  });

  it('list sorts newest issue date first', async () => {
    const repo = new InMemoryInvoiceRepository();
    await repo.create('INV-1', makeInput({ issueDate: '2026-01-01' }));
    await repo.create('INV-2', makeInput({ issueDate: '2026-06-01' }));
    const list = await repo.list();
    expect(list.map((i) => i.invoiceNumber)).toEqual(['INV-2', 'INV-1']);
  });

  it('list filters by search text against invoice number and customer name', async () => {
    const repo = new InMemoryInvoiceRepository();
    await repo.create('INV-1', makeInput({ customerName: 'Acme Co' }));
    await repo.create('INV-2', makeInput({ customerName: 'Globex' }));

    await expect(repo.list({ searchText: 'globex', status: 'all' })).resolves.toHaveLength(1);
    await expect(repo.list({ searchText: 'inv-1', status: 'all' })).resolves.toHaveLength(1);
  });

  it('list filters by customerId', async () => {
    const repo = new InMemoryInvoiceRepository();
    await repo.create('INV-1', makeInput({ customerId: 'cust_1' }));
    await repo.create('INV-2', makeInput({ customerId: 'cust_2' }));

    const list = await repo.list({ searchText: '', status: 'all', customerId: 'cust_2' });
    expect(list).toHaveLength(1);
    expect(list[0].invoiceNumber).toBe('INV-2');
  });

  it('update replaces items, dates, notes and terms but keeps id/number/customer/type', async () => {
    const repo = new InMemoryInvoiceRepository();
    const created = await repo.create('INV-1', makeInput());

    const updated = await repo.update(created.id, {
      issueDate: '2026-07-01',
      dueDate: null,
      notes: 'Updated notes',
      terms: 'Net 30',
      items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Replacement', unitPrice: 100 }],
    });

    expect(updated.id).toBe(created.id);
    expect(updated.invoiceNumber).toBe('INV-1');
    expect(updated.customerId).toBe('cust_1');
    expect(updated.issueDate).toBe('2026-07-01');
    expect(updated.dueDate).toBeNull();
    expect(updated.notes).toBe('Updated notes');
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].itemName).toBe('Replacement');
  });

  it('update throws for an unknown id', async () => {
    const repo = new InMemoryInvoiceRepository();
    await expect(
      repo.update('missing', {
        issueDate: '2026-01-01',
        dueDate: null,
        notes: null,
        terms: null,
        items: [],
      }),
    ).rejects.toThrow('Invoice not found');
  });

  it('delete removes the invoice; deleting an unknown id is a no-op', async () => {
    const repo = new InMemoryInvoiceRepository();
    const created = await repo.create('INV-1', makeInput());

    await repo.delete(created.id);
    await expect(repo.getById(created.id)).resolves.toBeNull();
    await expect(repo.delete('missing')).resolves.toBeUndefined();
  });

  it('a seed array is not shared with the caller', async () => {
    const seedInvoice = (await new InMemoryInvoiceRepository().create('INV-1', makeInput()));
    const seed = [seedInvoice];
    const repo = new InMemoryInvoiceRepository(seed);
    await repo.create('INV-2', makeInput());
    expect(seed).toHaveLength(1);
  });
});
