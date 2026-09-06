import { NullCustomerActivityRepository } from '../NullCustomerActivityRepository';
import { EMPTY_CUSTOMER_BALANCE_SUMMARY } from '@/domain/customer/types';

describe('NullCustomerActivityRepository', () => {
  it('returns a zero summary for any customer id (no Invoice/Payment tables exist yet)', async () => {
    const repo = new NullCustomerActivityRepository();
    await expect(repo.getSummary('any-customer')).resolves.toEqual(EMPTY_CUSTOMER_BALANCE_SUMMARY);
  });

  it('returns an empty history for any customer id', async () => {
    const repo = new NullCustomerActivityRepository();
    await expect(repo.getHistory('any-customer')).resolves.toEqual([]);
    await expect(repo.getHistory('any-customer', { type: 'invoice' })).resolves.toEqual([]);
  });
});
