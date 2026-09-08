import { getCloudStoragePlan } from '@/domain/cloudBackup/types';

import { CloudBackupNotConfiguredError, CloudBackupOfflineError, CloudBackupUnavailableError, CloudStorageLimitExceededError } from '../CloudBackupApi';
import { FakeCloudBackupApi } from '../FakeCloudBackupApi';

function envelope(size: number) {
  return { alg: 'aes-256-gcm-v1' as const, data: 'x'.repeat(size) };
}

describe('FakeCloudBackupApi', () => {
  it('reports zero usage against the free plan before anything is uploaded', async () => {
    const api = new FakeCloudBackupApi();
    const usage = await api.getStorageUsage();
    expect(usage).toEqual({ usedBytes: 0, limitBytes: getCloudStoragePlan('free').limitBytes, planId: 'free' });
  });

  it('upload/list/download/delete round-trip', async () => {
    const api = new FakeCloudBackupApi();
    const uploaded = await api.uploadBackup('a.json.enc', envelope(100));

    await expect(api.listBackups()).resolves.toEqual([uploaded]);
    await expect(api.downloadBackup(uploaded.id)).resolves.toEqual(envelope(100));
    await expect(api.getStorageUsage()).resolves.toMatchObject({ usedBytes: 100 });

    await api.deleteBackup(uploaded.id);
    await expect(api.listBackups()).resolves.toEqual([]);
  });

  it('rejects an upload that would exceed the plan storage limit', async () => {
    const api = new FakeCloudBackupApi();
    const limit = getCloudStoragePlan('free').limitBytes;

    await expect(api.uploadBackup('too-big.json.enc', envelope(limit + 1))).rejects.toBeInstanceOf(
      CloudStorageLimitExceededError,
    );
  });

  it('allows an upload that fits within a higher plan after upgrading', async () => {
    const api = new FakeCloudBackupApi();
    const freeLimit = getCloudStoragePlan('free').limitBytes;
    api.planId = 'plus';

    await expect(api.uploadBackup('big.json.enc', envelope(freeLimit + 1))).resolves.toBeTruthy();
  });

  it('simulateOffline throws CloudBackupOfflineError', async () => {
    const api = new FakeCloudBackupApi();
    api.simulateOffline = true;
    await expect(api.listBackups()).rejects.toBeInstanceOf(CloudBackupOfflineError);
  });

  it('simulateUnavailable throws CloudBackupUnavailableError', async () => {
    const api = new FakeCloudBackupApi();
    api.simulateUnavailable = true;
    await expect(api.listBackups()).rejects.toBeInstanceOf(CloudBackupUnavailableError);
  });

  it('simulateNotConfigured throws CloudBackupNotConfiguredError', async () => {
    const api = new FakeCloudBackupApi();
    api.simulateNotConfigured = true;
    await expect(api.listBackups()).rejects.toBeInstanceOf(CloudBackupNotConfiguredError);
  });

  it('downloading a missing file throws CloudBackupUnavailableError', async () => {
    const api = new FakeCloudBackupApi();
    await expect(api.downloadBackup('does-not-exist')).rejects.toBeInstanceOf(CloudBackupUnavailableError);
  });

  it('seedFile bypasses the storage-limit check (but still counts toward usage afterwards)', async () => {
    const api = new FakeCloudBackupApi();
    const limit = getCloudStoragePlan('free').limitBytes;
    api.seedFile(envelope(limit + 1000));

    await expect(api.listBackups()).resolves.toHaveLength(1);
    await expect(api.getStorageUsage()).resolves.toMatchObject({ usedBytes: limit + 1000 });
  });
});
