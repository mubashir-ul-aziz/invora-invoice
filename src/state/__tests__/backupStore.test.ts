import { BackupService } from '@/data/backup/BackupService';
import { InMemoryBackupLogRepository } from '@/data/backup/InMemoryBackupLogRepository';
import { InMemoryBackupRepository } from '@/data/backup/InMemoryBackupRepository';
import { InMemoryBackupSettingsRepository } from '@/data/backup/InMemoryBackupSettingsRepository';
import { FakeGoogleDriveBackupService } from '@/data/backup/googleDrive/FakeGoogleDriveBackupService';

import { createBackupStore } from '../backupStore';

function makeStore(clock?: () => number) {
  const backupRepository = new InMemoryBackupRepository();
  const logRepository = new InMemoryBackupLogRepository();
  const settingsRepository = new InMemoryBackupSettingsRepository();
  const driveService = new FakeGoogleDriveBackupService();
  const backupService = new BackupService(
    backupRepository,
    logRepository,
    settingsRepository,
    driveService,
    '1.0.0',
    clock ?? Date.now,
  );
  const store = createBackupStore({
    backupService,
    driveService,
    settingsRepository,
    logRepository,
    now: clock ?? Date.now,
  });
  return { store, driveService, settingsRepository, logRepository };
}

describe('backupStore', () => {
  it('load() populates settings, sign-in state, and history', async () => {
    const { store } = makeStore();
    await store.getState().load();
    expect(store.getState().status).toBe('ready');
    expect(store.getState().signedIn).toBe(false);
    expect(store.getState().settings.autoBackupEnabled).toBe(false);
    expect(store.getState().history).toEqual([]);
  });

  it('signIn() flips signedIn and loads remote backups', async () => {
    const { store, driveService } = makeStore();
    await driveService.signIn();
    await driveService.uploadBackup('existing.json', '{}');
    await driveService.signOut();

    await store.getState().signIn();

    expect(store.getState().signedIn).toBe(true);
    expect(store.getState().remoteBackups).toHaveLength(1);
  });

  it('signOut() clears signedIn and remote backups', async () => {
    const { store, driveService } = makeStore();
    await driveService.signIn();
    await store.getState().load();
    await store.getState().refreshRemoteBackups();

    await store.getState().signOut();

    expect(store.getState().signedIn).toBe(false);
    expect(store.getState().remoteBackups).toEqual([]);
  });

  it('setAutoBackupEnabled saves and reflects immediately', async () => {
    const { store } = makeStore();
    await store.getState().setAutoBackupEnabled(true);
    expect(store.getState().settings.autoBackupEnabled).toBe(true);
  });

  it('backupNow() on success updates settings and history and clears any error', async () => {
    const { store, driveService } = makeStore();
    await driveService.signIn();
    await store.getState().load();

    const entry = await store.getState().backupNow();

    expect(entry.status).toBe('success');
    expect(store.getState().status).toBe('ready');
    expect(store.getState().error).toBeNull();
    expect(store.getState().settings.lastBackupStatus).toBe('success');
    expect(store.getState().history).toHaveLength(1);
  });

  it('backupNow() on failure surfaces the error without throwing', async () => {
    const { store } = makeStore(); // not signed in
    const entry = await store.getState().backupNow();

    expect(entry.status).toBe('failure');
    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe(entry.errorMessage);
  });

  it('restore() on success refreshes history', async () => {
    const { store, driveService } = makeStore();
    await driveService.signIn();
    await store.getState().load();
    const backupEntry = await store.getState().backupNow();
    const remote = await driveService.listBackups();

    const restoreEntry = await store.getState().restore(remote[0].id);

    expect(restoreEntry.status).toBe('success');
    expect(store.getState().history.map((h) => h.id)).toEqual(
      expect.arrayContaining([backupEntry.id, restoreEntry.id]),
    );
  });

  it('restore() on failure surfaces the error', async () => {
    const { store, driveService } = makeStore();
    await driveService.signIn();
    await store.getState().load();

    const entry = await store.getState().restore('does-not-exist');

    expect(entry.status).toBe('failure');
    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe(entry.errorMessage);
  });

  describe('runAutomaticBackupIfDue', () => {
    it('does nothing when auto-backup is disabled', async () => {
      const { store, driveService, logRepository } = makeStore();
      await driveService.signIn();
      await store.getState().load();

      await store.getState().runAutomaticBackupIfDue();

      await expect(logRepository.list()).resolves.toEqual([]);
    });

    it('does nothing when not signed in, even if enabled', async () => {
      const { store, logRepository } = makeStore();
      await store.getState().load();
      await store.getState().setAutoBackupEnabled(true);

      await store.getState().runAutomaticBackupIfDue();

      await expect(logRepository.list()).resolves.toEqual([]);
    });

    it('runs a backup when enabled, signed in, and never backed up before', async () => {
      const { store, driveService, logRepository } = makeStore();
      await driveService.signIn();
      await store.getState().load();
      await store.getState().setAutoBackupEnabled(true);

      await store.getState().runAutomaticBackupIfDue();

      await expect(logRepository.list()).resolves.toHaveLength(1);
      expect(store.getState().settings.lastBackupStatus).toBe('success');
    });

    it('does not run again if the last backup was recent', async () => {
      const { store, driveService, logRepository } = makeStore();
      await driveService.signIn();
      await store.getState().load();
      await store.getState().setAutoBackupEnabled(true);
      await store.getState().runAutomaticBackupIfDue();

      await store.getState().runAutomaticBackupIfDue();

      await expect(logRepository.list()).resolves.toHaveLength(1);
    });

    it('runs again once the last backup is old enough', async () => {
      let now = Date.parse('2026-01-01T00:00:00.000Z');
      const { store, driveService, logRepository } = makeStore(() => now);
      await driveService.signIn();
      await store.getState().load();
      await store.getState().setAutoBackupEnabled(true);
      await store.getState().runAutomaticBackupIfDue();

      now += 25 * 60 * 60 * 1000; // > 24h later
      await store.getState().runAutomaticBackupIfDue();

      await expect(logRepository.list()).resolves.toHaveLength(2);
    });
  });
});
