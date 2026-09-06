import type { Customer, CustomerFilter, CustomerInput } from '@/domain/customer/types';

/**
 * The only door the state/controller layer is allowed to use to reach
 * customer contact data. Screens/components never import a concrete
 * repository, Drizzle table, or the sqlite client directly.
 */
export interface CustomerRepository {
  /** Returns customers matching the filter, sorted alphabetically by name. */
  list(filter?: CustomerFilter): Promise<Customer[]>;
  /** Returns a single customer, or null if it doesn't exist (e.g. already deleted). */
  getById(id: string): Promise<Customer | null>;
  create(input: CustomerInput): Promise<Customer>;
  update(id: string, input: CustomerInput): Promise<Customer>;
  delete(id: string): Promise<void>;
}
