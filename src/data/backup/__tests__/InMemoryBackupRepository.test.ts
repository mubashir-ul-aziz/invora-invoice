import { emptyBackupTables, tablesWith } from '@/domain/backup/testFixtures';

import { InMemoryBackupRepository } from '../InMemoryBackupRepository';

describe('InMemoryBackupRepository', () => {
  it('exports an empty dataset for a fresh install (backup with no data)', async () => {
    const repo = new InMemoryBackupRepository();
    await expect(repo.exportAll()).resolves.toEqual(emptyBackupTables());
  });

  it('exports exactly what was seeded, including a large dataset', async () => {
    const seeded = tablesWith({
      customers: Array.from({ length: 300 }, (_, i) => ({ id: `c${i}`, name: `Customer ${i}` })),
    });
    const repo = new InMemoryBackupRepository(seeded);
    const exported = await repo.exportAll();
    expect(exported.customers).toHaveLength(300);
  });

  it('restoreAll replaces the entire dataset (existing local data is overwritten)', async () => {
    const repo = new InMemoryBackupRepository(tablesWith({ customers: [{ id: 'old', name: 'Old Customer' }] }));
    await repo.restoreAll(tablesWith({ customers: [{ id: 'new', name: 'New Customer' }] }));
    const result = await repo.exportAll();
    expect(result.customers).toEqual([{ id: 'new', name: 'New Customer' }]);
  });

  it('a failed restore rolls back — existing local data is left intact', async () => {
    const original = tablesWith({ customers: [{ id: 'keep-me', name: 'Untouched' }] });
    const repo = new InMemoryBackupRepository(original);
    repo.simulateFailureOnRestore = new Error('simulated mid-write failure');

    await expect(repo.restoreAll(tablesWith({ customers: [{ id: 'should-not-land', name: 'x' }] }))).rejects.toThrow(
      'simulated mid-write failure',
    );

    await expect(repo.exportAll()).resolves.toEqual(original);
  });

  it('exportAll returns a copy — mutating the result does not affect internal state', async () => {
    const repo = new InMemoryBackupRepository(tablesWith({ customers: [{ id: 'c1', name: 'A' }] }));
    const exported = await repo.exportAll();
    exported.customers.push({ id: 'c2', name: 'B' } as never);
    await expect(repo.exportAll()).resolves.toEqual(tablesWith({ customers: [{ id: 'c1', name: 'A' }] }));
  });
});
