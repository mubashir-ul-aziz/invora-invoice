import {
  EMPTY_CUSTOMER_BALANCE_SUMMARY,
  type CustomerActivityEntry,
  type CustomerActivityFilter,
  type CustomerBalanceSummary,
} from '@/domain/customer/types';

import type { CustomerActivityRepository } from './CustomerActivityRepository';

/**
 * The real implementation wired at the composition root **today**. There is
 * no `Invoice` or `Payment` table yet (Phases 6/7), so there is nothing to
 * calculate a balance or history from — every customer honestly has zero
 * billed, zero paid, zero outstanding, zero overdue, and no history, rather
 * than this module inventing a stored/fake number to make the UI look
 * populated (explicitly disallowed by `MVP_BUILD_PLAN.md` §6.3).
 *
 * This is not a stub to delete later — it is the correct answer for "what is
 * this customer's balance" in a codebase state where no invoices exist yet.
 * See the interface doc comment for how Phase 6/7 replace it.
 */
export class NullCustomerActivityRepository implements CustomerActivityRepository {
  async getSummary(_customerId: string): Promise<CustomerBalanceSummary> {
    return EMPTY_CUSTOMER_BALANCE_SUMMARY;
  }

  async getHistory(
    _customerId: string,
    _filter?: CustomerActivityFilter,
  ): Promise<CustomerActivityEntry[]> {
    return [];
  }
}
