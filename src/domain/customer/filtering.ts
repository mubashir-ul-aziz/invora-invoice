import type { Customer, CustomerFilter } from './types';

/**
 * Pure search predicate shared by `InMemoryCustomerRepository` (tests that
 * run without SQLite) and as the documented contract `SqliteCustomerRepository`
 * reproduces with SQL `LIKE` — one definition of "what counts as a match"
 * instead of two implementations drifting apart. Same pattern as
 * `domain/item/filtering.ts`.
 */
export function customerMatchesFilter(customer: Customer, filter: CustomerFilter): boolean {
  const query = filter.searchText.trim().toLowerCase();
  if (!query) {
    return true;
  }
  const haystack = [customer.name, customer.phone, customer.email]
    .filter((value): value is string => !!value)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

/**
 * Canonical sort order for the Customer List screen: newest-created first.
 * Matches `sortInvoices`' newest-first ordering so both lists support the
 * same "Today / Yesterday / date" grouping (`domain/shared/dateSections.ts`).
 */
export function sortCustomers(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
