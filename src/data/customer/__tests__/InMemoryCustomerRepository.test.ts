import { InMemoryCustomerRepository } from '../InMemoryCustomerRepository';
import { EMPTY_CUSTOMER_INPUT } from '@/domain/customer/types';

describe('InMemoryCustomerRepository', () => {
  it('returns an empty list before anything is created', async () => {
    const repo = new InMemoryCustomerRepository();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('creates a customer and returns it with an id and timestamps', async () => {
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });

    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Acme Co');
    expect(created.createdAt).toBeTruthy();
    expect(created.updatedAt).toBeTruthy();
  });

  it('lists created customers sorted by name', async () => {
    const repo = new InMemoryCustomerRepository();
    await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Zebra Inc' });
    await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });

    const customers = await repo.list();
    expect(customers.map((c) => c.name)).toEqual(['Acme Co', 'Zebra Inc']);
  });

  it('reads a single customer by id, and null for an unknown id', async () => {
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });

    await expect(repo.getById(created.id)).resolves.toEqual(created);
    await expect(repo.getById('missing')).resolves.toBeNull();
  });

  it('updates an existing customer, keeping its id and createdAt', async () => {
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co', phone: '+15551234567' });

    const updated = await repo.update(created.id, {
      ...EMPTY_CUSTOMER_INPUT,
      name: 'Acme Corporation',
      phone: '+15559876543',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.name).toBe('Acme Corporation');
    expect(updated.phone).toBe('+15559876543');
  });

  it('throws when updating a customer that does not exist', async () => {
    const repo = new InMemoryCustomerRepository();
    await expect(repo.update('missing', EMPTY_CUSTOMER_INPUT)).rejects.toThrow();
  });

  it('deletes a customer', async () => {
    const repo = new InMemoryCustomerRepository();
    const created = await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co' });

    await repo.delete(created.id);

    await expect(repo.getById(created.id)).resolves.toBeNull();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('deleting an unknown id is a harmless no-op', async () => {
    const repo = new InMemoryCustomerRepository();
    await expect(repo.delete('missing')).resolves.toBeUndefined();
  });

  it('filters the list by search text', async () => {
    const repo = new InMemoryCustomerRepository();
    await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Acme Co', email: 'ap@acme.test' });
    await repo.create({ ...EMPTY_CUSTOMER_INPUT, name: 'Globex Inc', email: 'ap@globex.test' });

    await expect(repo.list({ searchText: 'acme' })).resolves.toHaveLength(1);
    await expect(repo.list({ searchText: 'globex.test' })).resolves.toHaveLength(1);
    await expect(repo.list({ searchText: 'nothing-matches' })).resolves.toHaveLength(0);
  });

  it('starts from a seed array without sharing state with the caller', async () => {
    const seedCustomer = { ...EMPTY_CUSTOMER_INPUT, name: 'Seeded' };
    const repo = new InMemoryCustomerRepository([
      { id: 's1', createdAt: 'now', updatedAt: 'now', ...seedCustomer },
    ]);
    const customers = await repo.list();
    expect(customers).toHaveLength(1);
    await repo.delete('s1');
    await expect(repo.list()).resolves.toEqual([]);
  });
});
