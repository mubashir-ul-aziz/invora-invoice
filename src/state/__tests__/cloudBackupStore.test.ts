import { InMemoryBackupLogRepository } from '@/data/backup/InMemoryBackupLogRepository';
import { InMemoryBackupRepository } from '@/data/backup/InMemoryBackupRepository';
import { CloudBackupService } from '@/data/cloudBackup/CloudBackupService';
import { FakeCloudBackupApi } from '@/data/cloudBackup/FakeCloudBackupApi';
import { InMemoryCloudBackupSettingsRepository } from '@/data/cloudBackup/InMemoryCloudBackupSettingsRepository';
import { FakeBackupEncryptionService } from '@/data/cloudBackup/encryption/FakeBackupEncryptionService';
import { PlaceholderCloudUpgradeService } from '@/data/subscription/PlaceholderCloudUpgradeService';

import { createCloudBackupStore } from '../cloudBackupStore';

function makeStore() {
  const backupRepository = new InMemoryBackupRepository();
  const logRepository = new InMemoryBackupLogRepository();
  const settingsRepository = new InMemoryCloudBackupSettingsRepository();
  const api = new FakeCloudBackupApi();
  const encryption = new FakeBackupEncryptionService();
  const upgradeService = new PlaceholderCloudUpgradeService();
  const cloudBackupService = new CloudBackupService(
    backupRepository,
    logRepository,
    settingsRepository,
    api,
    encryption,
    '1.0.0',
  );
  const store = createCloudBackupStore({ cloudBackupService, settingsRepository, logRepository, upgradeService });
  return { store, api, settingsRepository, logRepository, upgradeService };
}

describe('cloudBackupStore', () => {
  it('load() populates settings and cloud-only history', async () => {
    const { store } = makeStore();
    await store.getState().load();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().settings.cloudBackupEnabled).toBe(false);
    expect(store.getState().history).toEqual([]);
  });

  it('setCloudBackupEnabled saves and reflects immediately, and refreshes storage/remote backups once enabled', async () => {
    const { store } = makeStore();

    await store.getState().setCloudBackupEnabled(true);

    expect(store.getState().settings.cloudBackupEnabled).toBe(true);
    expect(store.getState().storageUsage).not.toBeNull();
  });

  it('disabling clears remote backups and storage usage', async () => {
    const { store } = makeStore();
    await store.getState().setCloudBackupEnabled(true);

    await store.getState().setCloudBackupEnabled(false);

    expect(store.getState().remoteBackups).toEqual([]);
    expect(store.getState().storageUsage).toBeNull();
  });

  it('backupNow() on success updates settings and history and clears any error', async () => {
    const { store } = makeStore();
    await store.getState().load();
    await store.getState().setCloudBackupEnabled(true);

    const entry = await store.getState().backupNow();

    expect(entry.status).toBe('success');
    expect(store.getState().status).toBe('ready');
    expect(store.getState().error).toBeNull();
    expect(store.getState().settings.lastCloudBackupStatus).toBe('success');
    expect(store.getState().history).toHaveLength(1);
  });

  it('backupNow() on failure surfaces the error without throwing', async () => {
    const { store } = makeStore(); // cloud backup not enabled
    const entry = await store.getState().backupNow();

    expect(entry.status).toBe('failure');
    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe(entry.errorMessage);
  });

  it('restore() on success refreshes history', async () => {
    const { store, api } = makeStore();
    await store.getState().setCloudBackupEnabled(true);
    const backupEntry = await store.getState().backupNow();
    const remote = await api.listBackups();

    const restoreEntry = await store.getState().restore(remote[0].id);

    expect(restoreEntry.status).toBe('success');
    expect(store.getState().history.map((h) => h.id)).toEqual(
      expect.arrayContaining([backupEntry.id, restoreEntry.id]),
    );
  });

  it('restore() on failure surfaces the error', async () => {
    const { store } = makeStore();
    await store.getState().setCloudBackupEnabled(true);

    const entry = await store.getState().restore('does-not-exist');

    expect(entry.status).toBe('failure');
    expect(store.getState().status).toBe('error');
    expect(store.getState().error).toBe(entry.errorMessage);
  });

  it('refreshStorageUsage surfaces an offline/unavailable error without crashing (Test: cloud backup unavailable)', async () => {
    const { store, api } = makeStore();
    api.simulateUnavailable = true;

    await store.getState().refreshStorageUsage();

    expect(store.getState().storageUsage).toBeNull();
    expect(store.getState().error).toBeTruthy();
  });

  it('getUpgradePlans/requestUpgrade delegate to the injected CloudUpgradeService (Upgrade storage placeholder)', async () => {
    const { store } = makeStore();

    expect(store.getState().getUpgradePlans().length).toBeGreaterThan(0);
    const result = await store.getState().requestUpgrade('plus');
    expect(result.status).toBe('unavailable');
  });
});
