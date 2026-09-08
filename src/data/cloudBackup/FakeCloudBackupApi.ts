import { generateLocalId } from '@/lib/id';
import { DEFAULT_CLOUD_STORAGE_PLAN_ID, getCloudStoragePlan, type CloudBackupFile, type CloudStoragePlanId, type CloudStorageUsage } from '@/domain/cloudBackup/types';

import {
  CloudBackupNotConfiguredError,
  CloudBackupOfflineError,
  CloudBackupUnavailableError,
  CloudStorageLimitExceededError,
  type CloudBackupApi,
} from './CloudBackupApi';
import type { EncryptedBackupEnvelope } from './encryption/BackupEncryptionService';

interface StoredFile {
  meta: CloudBackupFile;
  envelope: EncryptedBackupEnvelope;
}

/**
 * Jest-safe double every cloud-backup test injects instead of the real
 * `RestCloudBackupApi` — same role `FakeGoogleDriveBackupService` plays for
 * `GoogleDriveBackupService` (Phase 11). Tracks storage usage as the sum of
 * stored (encrypted) file sizes and enforces `planId`'s limit on upload —
 * the concrete behavior `CloudStorageLimitExceededError` tests rely on.
 */
export class FakeCloudBackupApi implements CloudBackupApi {
  private files: StoredFile[] = [];
  planId: CloudStoragePlanId = DEFAULT_CLOUD_STORAGE_PLAN_ID;
  /** When true, every method throws `CloudBackupOfflineError`. */
  simulateOffline = false;
  /** When true, every method throws `CloudBackupUnavailableError`. */
  simulateUnavailable = false;
  /** When true, every method throws `CloudBackupNotConfiguredError` — simulates a build with no `cloudBackupApiUrl` set. */
  simulateNotConfigured = false;

  private guard(): void {
    if (this.simulateNotConfigured) {
      throw new CloudBackupNotConfiguredError();
    }
    if (this.simulateOffline) {
      throw new CloudBackupOfflineError();
    }
    if (this.simulateUnavailable) {
      throw new CloudBackupUnavailableError();
    }
  }

  private usedBytes(): number {
    return this.files.reduce((sum, f) => sum + f.meta.sizeBytes, 0);
  }

  async getStorageUsage(): Promise<CloudStorageUsage> {
    this.guard();
    return { usedBytes: this.usedBytes(), limitBytes: getCloudStoragePlan(this.planId).limitBytes, planId: this.planId };
  }

  async uploadBackup(fileName: string, envelope: EncryptedBackupEnvelope): Promise<CloudBackupFile> {
    this.guard();
    const sizeBytes = envelope.data.length;
    const limitBytes = getCloudStoragePlan(this.planId).limitBytes;
    if (this.usedBytes() + sizeBytes > limitBytes) {
      throw new CloudStorageLimitExceededError();
    }
    const meta: CloudBackupFile = {
      id: generateLocalId('cloudfile_'),
      name: fileName,
      createdAt: new Date().toISOString(),
      sizeBytes,
    };
    this.files.push({ meta, envelope });
    return meta;
  }

  async listBackups(): Promise<CloudBackupFile[]> {
    this.guard();
    return [...this.files].map((f) => f.meta).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async downloadBackup(fileId: string): Promise<EncryptedBackupEnvelope> {
    this.guard();
    const file = this.files.find((f) => f.meta.id === fileId);
    if (!file) {
      throw new CloudBackupUnavailableError('That backup no longer exists in cloud storage.');
    }
    return file.envelope;
  }

  async deleteBackup(fileId: string): Promise<void> {
    this.guard();
    this.files = this.files.filter((f) => f.meta.id !== fileId);
  }

  /** Test-only helper for seeding a "backup already exists in the cloud" scenario without going through `uploadBackup()` — bypasses the storage-limit check `uploadBackup()` enforces (the seeded file still counts toward `getStorageUsage()`'s total afterwards, same as any other stored file). */
  seedFile(envelope: EncryptedBackupEnvelope, name = 'seed.json'): CloudBackupFile {
    const meta: CloudBackupFile = {
      id: generateLocalId('cloudfile_'),
      name,
      createdAt: new Date().toISOString(),
      sizeBytes: envelope.data.length,
    };
    this.files.push({ meta, envelope });
    return meta;
  }
}
