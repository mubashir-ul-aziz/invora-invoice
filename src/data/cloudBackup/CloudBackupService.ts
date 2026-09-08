import { buildBackupPayload, validateBackupPayload } from '@/domain/backup/validation';
import { countBackupTables, type BackupLogEntry, type BackupTrigger } from '@/domain/backup/types';
import { CLOUD_BACKUP_RETENTION_COUNT, type CloudBackupFile, type CloudStorageUsage } from '@/domain/cloudBackup/types';

import type { BackupLogRepository } from '../backup/BackupLogRepository';
import type { BackupRepository } from '../backup/BackupRepository';
import type { CloudBackupApi } from './CloudBackupApi';
import type { CloudBackupSettingsRepository } from './CloudBackupSettingsRepository';
import type { BackupEncryptionService } from './encryption/BackupEncryptionService';

const BACKUP_FILE_PREFIX = 'invora-cloud-backup-';

function backupFileName(createdAt: number): string {
  return `${BACKUP_FILE_PREFIX}${new Date(createdAt).toISOString().replace(/[:.]/g, '-')}.json.enc`;
}

function errorMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The use-case layer Phase 12's screens/store call — never `BackupRepository`,
 * `CloudBackupApi`, or `BackupEncryptionService` directly, same "screens
 * depend only on interfaces" rule every phase follows. Mirrors
 * `BackupService` (Phase 11 — Google Drive) almost exactly, and
 * deliberately **reuses**, rather than duplicates, its two data-layer doors:
 *
 * - `BackupRepository` — the same local-database export/restore door Google
 *   Drive backup uses. Cloud backup reads/restores the *identical* set of
 *   tables; there is no cloud-specific local repository.
 * - `BackupLogRepository` — the same `backup_log` history table, using its
 *   `destination: 'cloud'` value (added in this phase — see
 *   `domain/backup/types.ts`) instead of a second history table. This is
 *   exactly what Phase 11 built `destination` as free text for.
 *
 * What's actually new here, versus Phase 11: every payload is **encrypted
 * before it leaves the device** (`BackupEncryptionService`, since — unlike
 * Google Drive's private per-app App Data folder — the cloud object-storage
 * backend is a third party this app doesn't control), and uploads are
 * subject to a **storage limit** (`CloudBackupApi` throws
 * `CloudStorageLimitExceededError` instead of silently exceeding a device's
 * plan). Per `MVP_BUILD_PLAN.md`: this never synchronizes individual
 * database writes — a "backup" is always one full, versioned snapshot,
 * uploaded on request (manual) or opportunistically (automatic), exactly
 * like Google Drive backup.
 *
 * The `cloudBackupEnabled` toggle gates both `backupNow()` and
 * `restoreBackup()` — the cloud-backup equivalent of Drive's "signed in"
 * gate in `BackupService`.
 */
export class CloudBackupService {
  constructor(
    private readonly backupRepository: BackupRepository,
    private readonly logRepository: BackupLogRepository,
    private readonly settingsRepository: CloudBackupSettingsRepository,
    private readonly api: CloudBackupApi,
    private readonly encryption: BackupEncryptionService,
    private readonly appVersion: string,
    private readonly now: () => number = Date.now,
  ) {}

  /** Fetches and remembers (`recordPlan`) the plan this device is currently on — the "Storage usage"/"Storage limits" data source. Throws the same typed errors `CloudBackupApi` throws (offline/unavailable/not-configured); callers decide how to surface those (see `cloudBackupStore`). */
  async getStorageUsage(): Promise<CloudStorageUsage> {
    const usage = await this.api.getStorageUsage();
    await this.settingsRepository.recordPlan(usage.planId);
    return usage;
  }

  async listRemoteBackups(): Promise<CloudBackupFile[]> {
    return this.api.listBackups();
  }

  /**
   * Exports every table, wraps it in the same versioned+checksummed envelope
   * `BackupService` uses, encrypts it, and uploads it. Always ends by
   * recording a `BackupLogEntry` (`destination: 'cloud'`) and updating
   * `CloudBackupSettings` — on failure, the local database is never touched
   * (this only ever *reads* it via `exportAll()`).
   */
  async backupNow(trigger: BackupTrigger): Promise<BackupLogEntry> {
    const startedAt = this.now();
    try {
      const settings = await this.settingsRepository.getSettings();
      if (!settings.cloudBackupEnabled) {
        throw new Error('Turn on cloud backup before backing up.');
      }

      const tables = await this.backupRepository.exportAll();
      const payload = buildBackupPayload(tables, this.appVersion, startedAt);
      const content = JSON.stringify(payload);
      const counts = countBackupTables(tables);
      const envelope = await this.encryption.encrypt(content);

      await this.api.uploadBackup(backupFileName(startedAt), envelope);
      await this.pruneOldBackups();

      const finishedAt = this.now();
      await this.settingsRepository.recordAttempt({
        status: 'success',
        finishedAt: new Date(finishedAt).toISOString(),
        errorMessage: null,
      });
      return this.logRepository.add({
        direction: 'backup',
        trigger,
        status: 'success',
        destination: 'cloud',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        formatVersion: payload.formatVersion,
        sizeBytes: envelope.data.length,
        counts,
        errorMessage: null,
      });
    } catch (err) {
      const message = errorMessageOf(err);
      const finishedAt = this.now();
      await this.settingsRepository.recordAttempt({
        status: 'failure',
        finishedAt: new Date(finishedAt).toISOString(),
        errorMessage: message,
      });
      return this.logRepository.add({
        direction: 'backup',
        trigger,
        status: 'failure',
        destination: 'cloud',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        formatVersion: null,
        sizeBytes: null,
        counts: null,
        errorMessage: message,
      });
    }
  }

  /**
   * Downloads and decrypts the chosen backup, then validates it — version,
   * checksum, structure — exactly like `BackupService.restoreBackup()`,
   * before ever calling `BackupRepository.restoreAll()`. If validation
   * fails, or `restoreAll()` itself throws, the local database is left
   * exactly as it was — same "IMPORTANT SAFETY RULE" `MVP_BUILD_PLAN.md`
   * requires, unchanged by this phase.
   */
  async restoreBackup(fileId: string, trigger: BackupTrigger = 'manual'): Promise<BackupLogEntry> {
    const startedAt = this.now();
    try {
      const settings = await this.settingsRepository.getSettings();
      if (!settings.cloudBackupEnabled) {
        throw new Error('Turn on cloud backup before restoring.');
      }

      const envelope = await this.api.downloadBackup(fileId);
      const raw = await this.encryption.decrypt(envelope); // corrupted/undecryptable envelope throws here — local DB untouched.
      const payload = validateBackupPayload(raw); // throws BackupValidationError — local DB untouched.
      await this.backupRepository.restoreAll(payload.tables); // atomic — see SqliteBackupRepository.

      const finishedAt = this.now();
      return await this.logRepository.add({
        direction: 'restore',
        trigger,
        status: 'success',
        destination: 'cloud',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(finishedAt).toISOString(),
        formatVersion: payload.formatVersion,
        sizeBytes: envelope.data.length,
        counts: countBackupTables(payload.tables),
        errorMessage: null,
      });
    } catch (err) {
      const message = errorMessageOf(err);
      return this.logRepository.add({
        direction: 'restore',
        trigger,
        status: 'failure',
        destination: 'cloud',
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date(this.now()).toISOString(),
        formatVersion: null,
        sizeBytes: null,
        counts: null,
        errorMessage: message,
      });
    }
  }

  /** Deletes the oldest cloud backups beyond `CLOUD_BACKUP_RETENTION_COUNT`, called only after a new upload is confirmed — never before, mirroring `BackupService.pruneOldBackups()`. Best-effort: a pruning failure doesn't fail the backup that triggered it. */
  private async pruneOldBackups(): Promise<void> {
    try {
      const files = await this.api.listBackups();
      const sorted = [...files].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const stale = sorted.slice(CLOUD_BACKUP_RETENTION_COUNT);
      for (const file of stale) {
        await this.api.deleteBackup(file.id);
      }
    } catch {
      // Retention is a housekeeping nicety, not part of the safety contract — ignored.
    }
  }
}
