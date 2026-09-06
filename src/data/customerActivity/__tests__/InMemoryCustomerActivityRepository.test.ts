import { InMemoryCustomerActivityRepository } from '../InMemoryCustomerActivityRepository';
import { EMPTY_CUSTOMER_BALANCE_SUMMARY, type CustomerActivityEntry } from '@/domain/customer/types';

const entries: CustomerActivityEntry[] = [
  {
    id: 'inv1',
    type: 'invoice',
    date: '2026-01-01T00:00:00.000Z',
    title: 'Invoice INV-1',
    amount: 100,
    status: 'overdue',
  },
  {
    id: 'pay1',
    type: 'payment',
    date: '2026-01-05T00:00:00.000Z',
    title: 'Payment via Cash',
    amount: 40,
    status: 'cash',
  },
];

describe('InMemoryCustomerActivityRepository', () => {
  it('returns the empty summary/history for a customer with no seeded entries', async () => {
    const repo = new InMemoryCustomerActivityRepository();
    await expect(repo.getSummary('unknown')).resolves.toEqual(EMPTY_CUSTOMER_BALANCE_SUMMARY);
    await expect(repo.getHistory('unknown')).resolves.toEqual([]);
  });

  it('computes the summary from seeded entries for the matching customer only', async () => {
    const repo = new InMemoryCustomerActivityRepository({ c1: entries, c2: [] });

    const summary = await repo.getSummary('c1');
    expect(summary.totalBilled).toBe(100);
    expect(summary.totalPaid).toBe(40);
    expect(summary.outstanding).toBe(60);
    expect(summary.overdueAmount).toBe(100);
    expect(summary.invoiceCount).toBe(1);

    await expect(repo.getSummary('c2')).resolves.toEqual(EMPTY_CUSTOMER_BALANCE_SUMMARY);
  });

  it('returns history newest-first, filterable by type', async () => {
    const repo = new InMemoryCustomerActivityRepository({ c1: entries });

    const all = await repo.getHistory('c1');
    expect(all.map((e) => e.id)).toEqual(['pay1', 'inv1']);

    const invoicesOnly = await repo.getHistory('c1', { type: 'invoice' });
    expect(invoicesOnly.map((e) => e.id)).toEqual(['inv1']);

    const paymentsOnly = await repo.getHistory('c1', { type: 'payment' });
    expect(paymentsOnly.map((e) => e.id)).toEqual(['pay1']);
  });

  it('does not share seeded arrays with the caller', async () => {
    const seed = { c1: [...entries] };
    const repo = new InMemoryCustomerActivityRepository(seed);
    seed.c1.push({ ...entries[0], id: 'extra' });

    const history = await repo.getHistory('c1');
    expect(history).toHaveLength(2);
  });
});
