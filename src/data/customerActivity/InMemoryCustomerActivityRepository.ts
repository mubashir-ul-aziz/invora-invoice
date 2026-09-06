import {
  filterActivity,
  sortActivityChronological,
  summarizeActivity,
} from '@/domain/customer/activity';
import type {
  CustomerActivityEntry,
  CustomerActivityFilter,
  CustomerBalanceSummary,
} from '@/domain/customer/types';
import { EMPTY_CUSTOMER_ACTIVITY_FILTER } from '@/domain/customer/types';

import type { CustomerActivityRepository } from './CustomerActivityRepository';

/**
 * Frontend-first mock implementation — no database, no I/O, and no
 * dependency on Invoices/Payments existing yet. Lets the Customer Detail and
 * Customer History screens be built and interacted with against realistic
 * data (seeded per customer id) before Phase 6/7 provide the real thing. Not
 * wired at the composition root — see `NullCustomerActivityRepository` for
 * what's actually used today.
 */
export class InMemoryCustomerActivityRepository implements CustomerActivityRepository {
  private entriesByCustomer: Map<string, CustomerActivityEntry[]>;

  constructor(seed: Record<string, CustomerActivityEntry[]> = {}) {
    this.entriesByCustomer = new Map(Object.entries(seed).map(([id, entries]) => [id, [...entries]]));
  }

  async getSummary(customerId: string): Promise<CustomerBalanceSummary> {
    return summarizeActivity(this.entriesByCustomer.get(customerId) ?? []);
  }

  async getHistory(
    customerId: string,
    filter: CustomerActivityFilter = EMPTY_CUSTOMER_ACTIVITY_FILTER,
  ): Promise<CustomerActivityEntry[]> {
    const entries = this.entriesByCustomer.get(customerId) ?? [];
    return sortActivityChronological(filterActivity(entries, filter));
  }
}
