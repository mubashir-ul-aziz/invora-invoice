import { emptyBackupTables, tablesWith } from '@/domain/backup/testFixtures';
import { BACKUP_RETENTION_COUNT, type BackupTables } from '@/domain/backup/types';
import { buildBackupPayload } from '@/domain/backup/validation';

import { BackupService } from '../BackupService';
import { InMemoryBackupLogRepository } from '../InMemoryBackupLogRepository';
import { InMemoryBackupRepository } from '../InMemoryBackupRepository';
import { InMemoryBackupSettingsRepository } from '../InMemoryBackupSettingsRepository';
import { FakeGoogleDriveBackupService } from '../googleDrive/FakeGoogleDriveBackupService';

function makeService(opts: { seed?: BackupTables; clock?: () => number } = {}) {
  const backupRepository = new InMemoryBackupRepository(opts.seed);
  const logRepository = new InMemoryBackupLogRepository();
  const settingsRepository = new InMemoryBackupSettingsRepository();
  const driveService = new FakeGoogleDriveBackupService();
  const service = new BackupService(
    backupRepository,
    logRepository,
    settingsRepository,
    driveService,
    '1.0.0',
    opts.clock ?? Date.now,
  );
  return { service, backupRepository, logRepository, settingsRepository, driveService };
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
      appSettings: 0,
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

describe('BackupService.restoreBackup', () => {
  it('restores successfully and replaces existing local data (Test: existing local data, restore)', async () => {
    const existing = tablesWith({ customers: [{ id: 'old', name: 'Old' }] });
    const { service, driveService, backupRepository } = makeService({ seed: existing });
    await driveService.signIn();

    // Back up a *different* dataset directly via the drive service, simulating a backup made from another device/earlier state.
    const incoming = tablesWith({ customers: [{ id: 'new', name: 'New' }] });
    const payload = buildBackupPayload(incoming, '1.0.0');
    const uploaded = await driveService.uploadBackup('seed.json', JSON.stringify(payload));

    const entry = await service.restoreBackup(uploaded.id);

    expect(entry.status).toBe('success');
    await expect(backupRepository.exportAll()).resolves.toEqual(incoming);
  });

  it('fails cleanly and leaves local data untouched when the backup is corrupted (Test: corrupted backup)', async () => {
    const existing = tablesWith({ customers: [{ id: 'keep', name: 'Keep Me' }] });
    const { service, driveService, backupRepository } = makeService({ seed: existing });
    await driveService.signIn();

    const uploaded = driveService.seedFile('{"formatVersion":1,"tables":{}, "checksum": "not-real"}');

    const entry = await service.restoreBackup(uploaded.id);

    expect(entry.status).toBe('failure');
    await expect(backupRepository.exportAll()).resolves.toEqual(existing);
  });

  it('fails cleanly on an incompatible format version, leaving local data untouched', async () => {
    const existing = tablesWith({ customers: [{ id: 'keep', name: 'Keep Me' }] });
    const { service, driveService, backupRepository } = makeService({ seed: existing });
    await driveService.signIn();

    const payload = buildBackupPayload(tablesWith(), '1.0.0');
    // Only `formatVersion` changes — `tables` (and so `checksum`) stay valid,
    // isolating this test to the version check rather than the checksum one.
    const incompatible = { ...payload, formatVersion: 999 };
    const uploaded = driveService.seedFile(JSON.stringify(incompatible));

    const entry = await service.restoreBackup(uploaded.id);

    expect(entry.status).toBe('failure');
    await expect(backupRepository.exportAll()).resolves.toEqual(existing);
  });

  it('a failed restore (repository throws mid-write) leaves existing data intact (Test: failed restore)', async () => {
    const existing = tablesWith({ customers: [{ id: 'keep', name: 'Keep Me' }] });
    const { service, driveService, backupRepository } = makeService({ seed: existing });
    await driveService.signIn();

    const payload = buildBackupPayload(tablesWith({ customers: [{ id: 'new', name: 'New' }] }), '1.0.0');
    const uploaded = await driveService.uploadBackup('good.json', JSON.stringify(payload));

    backupRepository.simulateFailureOnRestore = new Error('disk full mid-restore');

    const entry = await service.restoreBackup(uploaded.id);

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/disk full/);
    await expect(backupRepository.exportAll()).resolves.toEqual(existing);
  });

  it('fails cleanly when not signed in', async () => {
    const { service } = makeService();
    const entry = await service.restoreBackup('some-file-id');
    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/sign in/i);
  });

  it('fails cleanly when offline', async () => {
    const { service, driveService } = makeService();
    await driveService.signIn();
    driveService.simulateOffline = true;
    const entry = await service.restoreBackup('some-file-id');
    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/offline/i);
  });

  it('fails cleanly when Google Drive is unavailable', async () => {
    const { service, driveService } = makeService();
    await driveService.signIn();
    driveService.simulateUnavailable = true;
    const entry = await service.restoreBackup('some-file-id');
    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/drive/i);
  });

  it('every restore attempt (success or failure) is recorded in history', async () => {
    const { service, driveService, logRepository } = makeService();
    await driveService.signIn();
    await service.restoreBackup('does-not-exist');
    await expect(logRepository.list()).resolves.toHaveLength(1);
    await expect(logRepository.list()).resolves.toMatchObject([{ direction: 'restore', status: 'failure' }]);
  });
});
