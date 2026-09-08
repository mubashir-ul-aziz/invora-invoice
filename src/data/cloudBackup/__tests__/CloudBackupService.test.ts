import { tablesWith } from '@/domain/backup/testFixtures';
import { type BackupTables } from '@/domain/backup/types';
import { buildBackupPayload } from '@/domain/backup/validation';
import { CLOUD_BACKUP_RETENTION_COUNT, getCloudStoragePlan } from '@/domain/cloudBackup/types';

import { InMemoryBackupLogRepository } from '../../backup/InMemoryBackupLogRepository';
import { InMemoryBackupRepository } from '../../backup/InMemoryBackupRepository';
import { CloudBackupService } from '../CloudBackupService';
import { CloudStorageLimitExceededError } from '../CloudBackupApi';
import { FakeCloudBackupApi } from '../FakeCloudBackupApi';
import { InMemoryCloudBackupSettingsRepository } from '../InMemoryCloudBackupSettingsRepository';
import { FakeBackupEncryptionService } from '../encryption/FakeBackupEncryptionService';

function makeService(opts: { seed?: BackupTables; clock?: () => number } = {}) {
  const backupRepository = new InMemoryBackupRepository(opts.seed);
  const logRepository = new InMemoryBackupLogRepository();
  const settingsRepository = new InMemoryCloudBackupSettingsRepository();
  const api = new FakeCloudBackupApi();
  const encryption = new FakeBackupEncryptionService();
  const service = new CloudBackupService(
    backupRepository,
    logRepository,
    settingsRepository,
    api,
    encryption,
    '1.0.0',
    opts.clock ?? Date.now,
  );
  return { service, backupRepository, logRepository, settingsRepository, api, encryption };
}

async function enable(settingsRepository: InMemoryCloudBackupSettingsRepository) {
  await settingsRepository.saveSettings({ cloudBackupEnabled: true });
}

describe('CloudBackupService.backupNow', () => {
  it('fails cleanly when cloud backup is not enabled, without touching local data', async () => {
    const { service, logRepository, settingsRepository } = makeService();
    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/turn on cloud backup/i);
    expect(entry.destination).toBe('cloud');
    await expect(logRepository.list()).resolves.toHaveLength(1);
    await expect(settingsRepository.getSettings()).resolves.toMatchObject({ lastCloudBackupStatus: 'failure' });
  });

  it('backs up an empty install (Test: backup with no data)', async () => {
    const { service, settingsRepository, api } = makeService({ seed: tablesWith() });
    await enable(settingsRepository);

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
    await expect(api.listBackups()).resolves.toHaveLength(1);
  });

  it('backs up a large dataset (Test: backup with large data)', async () => {
    const seed = tablesWith({
      customers: Array.from({ length: 1000 }, (_, i) => ({ id: `c${i}`, name: `Customer ${i}` })),
      invoices: Array.from({ length: 5000 }, (_, i) => ({ id: `inv${i}` })),
      invoiceItems: Array.from({ length: 20000 }, (_, i) => ({ id: `line${i}` })),
    });
    const { service, settingsRepository } = makeService({ seed });
    await enable(settingsRepository);

    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('success');
    expect(entry.counts?.invoiceItems).toBe(20000);
    expect(entry.sizeBytes).toBeGreaterThan(0);
  });

  it('encrypts the payload before it reaches the cloud API — the stored file never contains the plaintext JSON', async () => {
    const seed = tablesWith({ customers: [{ id: 'secret-customer', name: 'Top Secret Co' }] });
    const { service, settingsRepository, api } = makeService({ seed });
    await enable(settingsRepository);

    await service.backupNow('manual');

    const [remote] = await api.listBackups();
    const stored = await api.downloadBackup(remote.id);
    expect(stored.data).not.toContain('Top Secret Co');
    expect(stored.alg).toBe('aes-256-gcm-v1');
  });

  it('updates CloudBackupSettings.lastCloudBackupAt and last-attempt status on success', async () => {
    const { service, settingsRepository } = makeService();
    await enable(settingsRepository);
    await service.backupNow('manual');

    const settings = await settingsRepository.getSettings();
    expect(settings.lastCloudBackupStatus).toBe('success');
    expect(settings.lastCloudBackupAt).not.toBeNull();
  });

  it('handles offline state without throwing out of the service (Test: offline state)', async () => {
    const { service, settingsRepository, api } = makeService();
    await enable(settingsRepository);
    api.simulateOffline = true;

    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/offline/i);
  });

  it('handles the cloud backend being unavailable (Test: cloud backup unavailable)', async () => {
    const { service, settingsRepository, api } = makeService();
    await enable(settingsRepository);
    api.simulateUnavailable = true;

    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/cloud backup/i);
  });

  it('handles an unconfigured build without crashing the app (Test: cloud backup unavailable/not configured)', async () => {
    const { service, settingsRepository, api } = makeService();
    await enable(settingsRepository);
    api.simulateNotConfigured = true;

    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/not configured/i);
  });

  it('fails cleanly when the upload would exceed the storage limit (Test: storage limits)', async () => {
    const { service, settingsRepository, api, logRepository } = makeService();
    await enable(settingsRepository);
    jest.spyOn(api, 'uploadBackup').mockRejectedValue(new CloudStorageLimitExceededError());

    const entry = await service.backupNow('manual');

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/storage limit/i);
    await expect(logRepository.list()).resolves.toMatchObject([{ status: 'failure', destination: 'cloud' }]);
  });

  it('does not overwrite lastCloudBackupAt when a later attempt fails', async () => {
    const { service, settingsRepository, api } = makeService();
    await enable(settingsRepository);
    await service.backupNow('manual');
    const afterSuccess = await settingsRepository.getSettings();

    api.simulateUnavailable = true;
    await service.backupNow('manual');
    const afterFailure = await settingsRepository.getSettings();

    expect(afterFailure.lastCloudBackupAt).toBe(afterSuccess.lastCloudBackupAt);
    expect(afterFailure.lastCloudBackupStatus).toBe('failure');
  });

  it('prunes old cloud backups beyond the retention count only after a new upload succeeds', async () => {
    const { service, settingsRepository, api } = makeService();
    await enable(settingsRepository);

    for (let i = 0; i < CLOUD_BACKUP_RETENTION_COUNT + 3; i += 1) {
      await service.backupNow('manual');
    }

    const remaining = await api.listBackups();
    expect(remaining.length).toBeLessThanOrEqual(CLOUD_BACKUP_RETENTION_COUNT);
  });

  it('every attempt is logged with destination "cloud"', async () => {
    const { service, settingsRepository, logRepository } = makeService();
    await enable(settingsRepository);
    await service.backupNow('manual');

    await expect(logRepository.list()).resolves.toMatchObject([{ destination: 'cloud', direction: 'backup' }]);
  });
});

describe('CloudBackupService.getStorageUsage', () => {
  it('reports usage and remembers the plan on CloudBackupSettings', async () => {
    const { service, settingsRepository } = makeService();
    const usage = await service.getStorageUsage();

    expect(usage.planId).toBe('free');
    expect(usage.limitBytes).toBe(getCloudStoragePlan('free').limitBytes);
    await expect(settingsRepository.getSettings()).resolves.toMatchObject({ planId: 'free' });
  });
});

describe('CloudBackupService.restoreBackup', () => {
  it('restores successfully and replaces existing local data (Test: existing local data, restore)', async () => {
    const existing = tablesWith({ customers: [{ id: 'old', name: 'Old' }] });
    const { service, settingsRepository, backupRepository, api, encryption } = makeService({ seed: existing });
    await enable(settingsRepository);

    const incoming = tablesWith({ customers: [{ id: 'new', name: 'New' }] });
    const payload = buildBackupPayload(incoming, '1.0.0');
    const envelope = await encryption.encrypt(JSON.stringify(payload));
    const uploaded = await api.uploadBackup('seed.json.enc', envelope);

    const entry = await service.restoreBackup(uploaded.id);

    expect(entry.status).toBe('success');
    await expect(backupRepository.exportAll()).resolves.toEqual(incoming);
  });

  it('fails cleanly and leaves local data untouched when the backup is corrupted (Test: corrupted backup)', async () => {
    const existing = tablesWith({ customers: [{ id: 'keep', name: 'Keep Me' }] });
    const { service, settingsRepository, backupRepository, api, encryption } = makeService({ seed: existing });
    await enable(settingsRepository);

    const envelope = await encryption.encrypt('{"formatVersion":1,"tables":{}, "checksum": "not-real"}');
    const uploaded = api.seedFile(envelope);

    const entry = await service.restoreBackup(uploaded.id);

    expect(entry.status).toBe('failure');
    await expect(backupRepository.exportAll()).resolves.toEqual(existing);
  });

  it('fails cleanly on an incompatible format version, leaving local data untouched', async () => {
    const existing = tablesWith({ customers: [{ id: 'keep', name: 'Keep Me' }] });
    const { service, settingsRepository, backupRepository, api, encryption } = makeService({ seed: existing });
    await enable(settingsRepository);

    const payload = buildBackupPayload(tablesWith(), '1.0.0');
    const incompatible = { ...payload, formatVersion: 999 };
    const envelope = await encryption.encrypt(JSON.stringify(incompatible));
    const uploaded = api.seedFile(envelope);

    const entry = await service.restoreBackup(uploaded.id);

    expect(entry.status).toBe('failure');
    await expect(backupRepository.exportAll()).resolves.toEqual(existing);
  });

  it('a failed restore (repository throws mid-write) leaves existing data intact (Test: failed restore)', async () => {
    const existing = tablesWith({ customers: [{ id: 'keep', name: 'Keep Me' }] });
    const { service, settingsRepository, backupRepository, api, encryption } = makeService({ seed: existing });
    await enable(settingsRepository);

    const payload = buildBackupPayload(tablesWith({ customers: [{ id: 'new', name: 'New' }] }), '1.0.0');
    const envelope = await encryption.encrypt(JSON.stringify(payload));
    const uploaded = await api.uploadBackup('good.json.enc', envelope);

    backupRepository.simulateFailureOnRestore = new Error('disk full mid-restore');

    const entry = await service.restoreBackup(uploaded.id);

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/disk full/);
    await expect(backupRepository.exportAll()).resolves.toEqual(existing);
  });

  it('fails cleanly with an undecryptable envelope, leaving local data untouched', async () => {
    const existing = tablesWith({ customers: [{ id: 'keep', name: 'Keep Me' }] });
    const { service, settingsRepository, backupRepository, api, encryption } = makeService({ seed: existing });
    await enable(settingsRepository);
    encryption.simulateDecryptFailure = new Error('bad key');
    const uploaded = api.seedFile({ alg: 'aes-256-gcm-v1', data: 'anything' });

    const entry = await service.restoreBackup(uploaded.id);

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/bad key/);
    await expect(backupRepository.exportAll()).resolves.toEqual(existing);
  });

  it('fails cleanly when cloud backup is not enabled', async () => {
    const { service } = makeService();
    const entry = await service.restoreBackup('some-file-id');
    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/turn on cloud backup/i);
  });

  it('every restore attempt (success or failure) is recorded with destination "cloud"', async () => {
    const { service, settingsRepository, logRepository } = makeService();
    await enable(settingsRepository);
    await service.restoreBackup('does-not-exist');

    await expect(logRepository.list()).resolves.toMatchObject([
      { direction: 'restore', status: 'failure', destination: 'cloud' },
    ]);
  });
});
