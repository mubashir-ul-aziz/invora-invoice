import { tablesWith } from '@/domain/backup/testFixtures';
import { BACKUP_FORMAT_VERSION, BACKUP_RETENTION_COUNT, type BackupTables } from '@/domain/backup/types';
import { validateBackupPayload } from '@/domain/backup/validation';

import { createBackupHarness } from '../testHarness';

function makeService(opts: { seed?: BackupTables; clock?: () => number } = {}) {
  const harness = createBackupHarness(opts);
  return { ...harness, service: harness.backupService };
}

describe('BackupService.backupNow', () => {
  it('fails cleanly when not signed in to Google Drive, without touching local data', async () => {
    const { service, logRepository, settingsRepository } = makeService();
    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/sign in/i);
    await expect(logRepository.list()).resolves.toHaveLength(1);
    await expect(settingsRepository.getSettings()).resolves.toMatchObject({ lastBackupStatus: 'failure' });
  });

  it('backs up an empty install (Test: backup with no data)', async () => {
    const { service, driveService } = makeService({ seed: tablesWith() });
    await driveService.signIn();

    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('success');
    expect(entry.counts).toEqual({
      business: 0,
      socialLinks: 0,
      items: 0,
      customers: 0,
      invoices: 0,
      invoiceItems: 0,
      payments: 0,
    });
    await expect(driveService.listBackups()).resolves.toHaveLength(1);
  });

  it('backs up a large dataset (Test: backup with large data)', async () => {
    const seed = tablesWith({
      customers: Array.from({ length: 1000 }, (_, i) => ({ id: `c${i}`, name: `Customer ${i}` })),
      invoices: Array.from({ length: 5000 }, (_, i) => ({ id: `inv${i}` })),
      invoiceItems: Array.from({ length: 20000 }, (_, i) => ({ id: `line${i}` })),
    });
    const { service, driveService } = makeService({ seed });
    await driveService.signIn();

    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('success');
    expect(entry.counts?.invoiceItems).toBe(20000);
    expect(entry.sizeBytes).toBeGreaterThan(0);
  });

  it('updates BackupSettings.lastBackupAt and last-attempt status on success', async () => {
    const { service, driveService, settingsRepository } = makeService();
    await driveService.signIn();
    await service.backupNow('manual');

    const settings = await settingsRepository.getSettings();
    expect(settings.lastBackupStatus).toBe('success');
    expect(settings.lastBackupAt).not.toBeNull();
  });

  it('handles offline state without throwing out of the service (Test: offline state)', async () => {
    const { service, driveService, settingsRepository } = makeService();
    await driveService.signIn();
    driveService.simulateOffline = true;

    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/offline/i);
    await expect(settingsRepository.getSettings()).resolves.toMatchObject({ lastBackupStatus: 'failure' });
  });

  it('handles Google Drive being unavailable (Test: Google Drive unavailable)', async () => {
    const { service, driveService } = makeService();
    await driveService.signIn();
    driveService.simulateUnavailable = true;

    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/drive/i);
  });

  it('does not overwrite lastBackupAt when a later attempt fails', async () => {
    const { service, driveService, settingsRepository } = makeService();
    await driveService.signIn();
    await service.backupNow('manual');
    const afterSuccess = await settingsRepository.getSettings();

    driveService.simulateUnavailable = true;
    await service.backupNow('manual');
    const afterFailure = await settingsRepository.getSettings();

    expect(afterFailure.lastBackupAt).toBe(afterSuccess.lastBackupAt);
    expect(afterFailure.lastBackupStatus).toBe('failure');
  });

  it('prunes old remote backups beyond the retention count only after a new upload succeeds', async () => {
    const { service, driveService } = makeService();
    await driveService.signIn();

    for (let i = 0; i < BACKUP_RETENTION_COUNT + 3; i += 1) {
      await service.backupNow('manual');
    }

    const remaining = await driveService.listBackups();
    expect(remaining.length).toBeLessThanOrEqual(BACKUP_RETENTION_COUNT);
  });
});

describe('BackupService — Drive files in the history', () => {
  it('records the Drive file id and name, and uploads the shared current-version format', async () => {
    const { service, driveService } = makeService({ clock: () => new Date(2026, 9, 29, 14, 30, 5).getTime() });
    await driveService.signIn();

    const entry = await service.backupNow('automatic');

    const [file] = await driveService.listBackups();
    expect(entry.remoteFileId).toBe(file.id);
    expect(entry.fileName).toBe('metriqo-backup-2026-10-29-143005.json');
    const content = await driveService.downloadBackup(file.id);
    expect(validateBackupPayload(content).formatVersion).toBe(BACKUP_FORMAT_VERSION);
  });

  it('deletes a Drive backup and its history row', async () => {
    const { service, driveService, logRepository } = makeService();
    await driveService.signIn();
    const entry = await service.backupNow('manual');

    await service.deleteRemoteBackup(entry.remoteFileId!, entry.id);

    await expect(driveService.listBackups()).resolves.toHaveLength(0);
    await expect(logRepository.get(entry.id)).resolves.toBeNull();
  });

  it('refuses to download when signed out', async () => {
    const { service } = makeService();
    await expect(service.downloadBackup('anything')).rejects.toThrow(/sign in/i);
  });
});
