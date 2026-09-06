import { ZeroPaymentTotalsRepository } from '../ZeroPaymentTotalsRepository';

describe('ZeroPaymentTotalsRepository', () => {
  it('reports zero paid for any single invoice', async () => {
    const repo = new ZeroPaymentTotalsRepository();
    await expect(repo.getTotalPaid('inv_1')).resolves.toBe(0);
  });

  it('reports zero paid for every invoice in a batch', async () => {
    const repo = new ZeroPaymentTotalsRepository();
    await expect(repo.getTotalPaidForInvoices(['inv_1', 'inv_2'])).resolves.toEqual({
      inv_1: 0,
      inv_2: 0,
    });
  });

  it('returns an empty map for an empty batch', async () => {
    const repo = new ZeroPaymentTotalsRepository();
    await expect(repo.getTotalPaidForInvoices([])).resolves.toEqual({});
  });
});
