import { EMPTY_BACKUP_SETTINGS } from '@/domain/backup/types';

import { InMemoryBackupSettingsRepository } from '../InMemoryBackupSettingsRepository';

describe('InMemoryBackupSettingsRepository', () => {
  it('defaults to off / never backed up', async () => {
    const repo = new InMemoryBackupSettingsRepository();
    await expect(repo.getSettings()).resolves.toEqual(EMPTY_BACKUP_SETTINGS);
  });

  it('saveSettings only touches autoBackupEnabled', async () => {
    const repo = new InMemoryBackupSettingsRepository();
    await repo.recordAttempt({ status: 'success', finishedAt: '2026-01-01T00:00:00.000Z', errorMessage: null });
    await repo.saveSettings({ autoBackupEnabled: true });

    const settings = await repo.getSettings();
    expect(settings.autoBackupEnabled).toBe(true);
    expect(settings.lastBackupAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('recordAttempt(success) updates lastBackupAt and status', async () => {
    const repo = new InMemoryBackupSettingsRepository();
    const settings = await repo.recordAttempt({
      status: 'success',
      finishedAt: '2026-02-01T00:00:00.000Z',
      errorMessage: null,
    });
    expect(settings).toMatchObject({
      lastBackupAt: '2026-02-01T00:00:00.000Z',
      lastBackupStatus: 'success',
      lastBackupError: null,
    });
  });

  it('recordAttempt(failure) does not overwrite the last successful lastBackupAt', async () => {
    const repo = new InMemoryBackupSettingsRepository();
    await repo.recordAttempt({ status: 'success', finishedAt: '2026-01-01T00:00:00.000Z', errorMessage: null });
    const settings = await repo.recordAttempt({
      status: 'failure',
      finishedAt: '2026-01-02T00:00:00.000Z',
      errorMessage: 'Google Drive is unavailable',
    });
    expect(settings.lastBackupAt).toBe('2026-01-01T00:00:00.000Z');
    expect(settings.lastBackupStatus).toBe('failure');
    expect(settings.lastBackupError).toBe('Google Drive is unavailable');
  });
});
