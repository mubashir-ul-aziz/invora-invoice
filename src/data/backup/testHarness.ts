import type { BackupTables } from '@/domain/backup/types';

import { BackupPayloadService } from './BackupPayloadService';
import { BackupRestoreService } from './BackupRestoreService';
import { BackupService } from './BackupService';
import { FakeBackupFileExchange } from './files/FakeBackupFileExchange';
import { InMemoryBackupAssetStore } from './files/InMemoryBackupAssetStore';
import { InMemoryLocalBackupFileStore } from './files/InMemoryLocalBackupFileStore';
import { FakeGoogleDriveBackupService } from './googleDrive/FakeGoogleDriveBackupService';
import { InMemoryBackupLogRepository } from './InMemoryBackupLogRepository';
import { InMemoryBackupRepository } from './InMemoryBackupRepository';
import { InMemoryBackupSettingsRepository } from './InMemoryBackupSettingsRepository';
import { LocalBackupService } from './LocalBackupService';

/**
 * Test-only: every backup service wired to in-memory/fake storage, the same
 * way `data/container.ts` wires the real ones — so tests exercise the real
 * orchestration end to end without a device.
 */
export function createBackupHarness(opts: { seed?: BackupTables; clock?: () => number } = {}) {
  const clock = opts.clock ?? Date.now;
  const backupRepository = new InMemoryBackupRepository(opts.seed);
  const assets = new InMemoryBackupAssetStore();
  const files = new InMemoryLocalBackupFileStore();
  const exchange = new FakeBackupFileExchange();
  const logRepository = new InMemoryBackupLogRepository();
  const settingsRepository = new InMemoryBackupSettingsRepository();
  const driveService = new FakeGoogleDriveBackupService();
  const payloads = new BackupPayloadService(backupRepository, assets, '1.0.0', clock);
  const backupService = new BackupService(payloads, logRepository, settingsRepository, driveService, clock);
  const localBackupService = new LocalBackupService(payloads, files, logRepository, clock);
  const restoreService = new BackupRestoreService(payloads, localBackupService, backupService, exchange, logRepository, clock);
  return {
    backupRepository,
    assets,
    files,
    exchange,
    logRepository,
    settingsRepository,
    driveService,
    payloads,
    backupService,
    localBackupService,
    restoreService,
  };
}
