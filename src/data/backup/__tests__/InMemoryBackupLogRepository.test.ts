import { InMemoryBackupLogRepository } from '../InMemoryBackupLogRepository';

describe('InMemoryBackupLogRepository', () => {
  it('starts empty', async () => {
    const repo = new InMemoryBackupLogRepository();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('adds an entry and assigns it an id', async () => {
    const repo = new InMemoryBackupLogRepository();
    const saved = await repo.add({
      direction: 'backup',
      trigger: 'manual',
      status: 'success',
      destination: 'google_drive',
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:05.000Z',
      formatVersion: 1,
      sizeBytes: 1234,
      counts: null,
      errorMessage: null,
    });
    expect(saved.id).toBeTruthy();
    await expect(repo.list()).resolves.toEqual([saved]);
  });

  it('lists newest first', async () => {
    const repo = new InMemoryBackupLogRepository();
    const first = await repo.add({
      direction: 'backup',
      trigger: 'manual',
      status: 'success',
      destination: 'google_drive',
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: null,
      formatVersion: 1,
      sizeBytes: null,
      counts: null,
      errorMessage: null,
    });
    const second = await repo.add({
      direction: 'restore',
      trigger: 'manual',
      status: 'failure',
      destination: 'google_drive',
      startedAt: '2026-01-02T00:00:00.000Z',
      finishedAt: null,
      formatVersion: null,
      sizeBytes: null,
      counts: null,
      errorMessage: 'boom',
    });

    await expect(repo.list()).resolves.toEqual([second, first]);
  });
});
