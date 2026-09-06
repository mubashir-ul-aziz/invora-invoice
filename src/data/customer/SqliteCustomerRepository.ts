import { and, eq, like, or } from 'drizzle-orm';

import { EMPTY_CUSTOMER_FILTER, type Customer, type CustomerFilter, type CustomerInput } from '@/domain/customer/types';
import { generateLocalId } from '@/lib/id';

import { getDatabase, getDrizzle } from '../db/client';
import { customer } from '../db/schema';
import type { CustomerRepository } from './CustomerRepository';

function toCustomer(row: typeof customer.$inferSelect): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Real implementation of `CustomerRepository` against the `customer` table
 * (`db/schema.ts`). No Jest coverage — Jest can't drive the native SQLite
 * module without a device, same as every other Sqlite* repository in this
 * codebase; the search semantics it implements in SQL are unit-tested once,
 * in plain TypeScript, via `domain/customer/filtering.ts`'s
 * `customerMatchesFilter`, which `InMemoryCustomerRepository` runs directly.
 */
export class SqliteCustomerRepository implements CustomerRepository {
  async list(filter: CustomerFilter = EMPTY_CUSTOMER_FILTER): Promise<Customer[]> {
    await getDatabase();
    const db = getDrizzle();

    const query = filter.searchText.trim();
    const conditions = [];
    if (query) {
      const pattern = `%${query}%`;
      conditions.push(
        or(like(customer.name, pattern), like(customer.phone, pattern), like(customer.email, pattern)),
      );
    }

    const rows = await db
      .select()
      .from(customer)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(customer.name);

    return rows.map(toCustomer);
  }

  async getById(id: string): Promise<Customer | null> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(customer).where(eq(customer.id, id));
    const row = rows[0];
    return row ? toCustomer(row) : null;
  }

  async create(input: CustomerInput): Promise<Customer> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const values = {
      id: generateLocalId('cust_'),
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(customer).values(values);

    const created = await this.getById(values.id);
    if (!created) {
      throw new Error('Failed to read back the customer after creating it.');
    }
    return created;
  }

  async update(id: string, input: CustomerInput): Promise<Customer> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    await db
      .update(customer)
      .set({
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address,
        notes: input.notes,
        updatedAt: now,
      })
      .where(eq(customer.id, id));

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error(`Customer not found after update: ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await getDatabase();
    const db = getDrizzle();
    await db.delete(customer).where(eq(customer.id, id));
  }
}
