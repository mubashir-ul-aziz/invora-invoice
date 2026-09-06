import { customerMatchesFilter, sortCustomers } from '@/domain/customer/filtering';
import {
  EMPTY_CUSTOMER_FILTER,
  type Customer,
  type CustomerFilter,
  type CustomerInput,
} from '@/domain/customer/types';
import { generateLocalId } from '@/lib/id';

import type { CustomerRepository } from './CustomerRepository';

/**
 * Frontend-first mock repository — no database, no I/O. Used to build and
 * unit-test the Customers UI/state layer before the SQLite-backed repository
 * exists, and kept afterwards for fast Jest tests (same role as
 * `InMemoryItemRepository` in Phase 4).
 */
export class InMemoryCustomerRepository implements CustomerRepository {
  private customers: Customer[];

  constructor(seed: Customer[] = []) {
    this.customers = [...seed];
  }

  async list(filter: CustomerFilter = EMPTY_CUSTOMER_FILTER): Promise<Customer[]> {
    return sortCustomers(this.customers.filter((customer) => customerMatchesFilter(customer, filter)));
  }

  async getById(id: string): Promise<Customer | null> {
    return this.customers.find((customer) => customer.id === id) ?? null;
  }

  async create(input: CustomerInput): Promise<Customer> {
    const now = new Date().toISOString();
    const customer: Customer = {
      id: generateLocalId('cust_'),
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.customers.push(customer);
    return customer;
  }

  async update(id: string, input: CustomerInput): Promise<Customer> {
    const index = this.customers.findIndex((customer) => customer.id === id);
    if (index === -1) {
      throw new Error(`Customer not found: ${id}`);
    }
    const updated: Customer = {
      ...this.customers[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    this.customers[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.customers = this.customers.filter((customer) => customer.id !== id);
  }
}
