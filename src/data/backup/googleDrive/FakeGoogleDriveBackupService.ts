import { generateLocalId } from '@/lib/id';
import type { DriveBackupFile } from '@/domain/backup/types';

import { DriveUnavailableError, NotSignedInError, OfflineError, type GoogleDriveBackupService } from './GoogleDriveBackupService';

interface StoredFile {
  meta: DriveBackupFile;
  content: string;
}

/**
 * Jest-safe double every backup test injects instead of the real
 * `ExpoGoogleDriveBackupService` — same role `FakeBiometricService` plays for
 * `BiometricService` (Phase 10). Configurable failure modes cover the
 * brief's "Test: ... Offline state, Google Drive unavailable" scenarios
 * without a device or real network.
 */
export class FakeGoogleDriveBackupService implements GoogleDriveBackupService {
  private signedIn = false;
  private files: StoredFile[] = [];
  /** When true, every method throws `OfflineError` — simulates airplane mode / no network. */
  simulateOffline = false;
  /** When true, every method throws `DriveUnavailableError` — simulates a Drive-side outage/failure while the device itself is online. */
  simulateUnavailable = false;

  private guard(): void {
    if (this.simulateOffline) {
      throw new OfflineError();
    }
    if (this.simulateUnavailable) {
      throw new DriveUnavailableError();
    }
  }

  private requireSignedIn(): void {
    if (!this.signedIn) {
      throw new NotSignedInError();
    }
  }

  async isSignedIn(): Promise<boolean> {
    return this.signedIn;
  }

  async signIn(): Promise<void> {
    this.guard();
    this.signedIn = true;
  }

  async signOut(): Promise<void> {
    this.signedIn = false;
  }

  async uploadBackup(fileName: string, content: string): Promise<DriveBackupFile> {
    this.guard();
    this.requireSignedIn();
    const meta: DriveBackupFile = {
      id: generateLocalId('drivefile_'),
      name: fileName,
      createdAt: new Date().toISOString(),
      sizeBytes: content.length,
    };
    this.files.push({ meta, content });
    return meta;
  }

  async listBackups(): Promise<DriveBackupFile[]> {
    this.guard();
    this.requireSignedIn();
    return [...this.files].map((f) => f.meta).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async downloadBackup(fileId: string): Promise<string> {
    this.guard();
    this.requireSignedIn();
    const file = this.files.find((f) => f.meta.id === fileId);
    if (!file) {
      throw new DriveUnavailableError('That backup file no longer exists on Google Drive.');
    }
    return file.content;
  }

  async deleteBackup(fileId: string): Promise<void> {
    this.guard();
    this.requireSignedIn();
    this.files = this.files.filter((f) => f.meta.id !== fileId);
  }

  /** Test-only helper for seeding a "backup already exists on Drive" scenario without going through `uploadBackup()`. */
  seedFile(content: string, name = 'seed.json'): DriveBackupFile {
    const meta: DriveBackupFile = {
      id: generateLocalId('drivefile_'),
      name,
      createdAt: new Date().toISOString(),
      sizeBytes: content.length,
    };
    this.files.push({ meta, content });
    return meta;
  }
}
