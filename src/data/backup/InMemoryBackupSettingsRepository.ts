import { EMPTY_BACKUP_SETTINGS, type BackupSettings, type BackupSettingsInput } from '@/domain/backup/types';

import type { BackupAttemptResult, BackupSettingsRepository } from './BackupSettingsRepository';

/** Mock/testing implementation — see `SqliteBackupSettingsRepository` for the real one. */
export class InMemoryBackupSettingsRepository implements BackupSettingsRepository {
  private settings: BackupSettings = { ...EMPTY_BACKUP_SETTINGS };

  async getSettings(): Promise<BackupSettings> {
    return { ...this.settings };
  }

  async saveSettings(input: BackupSettingsInput): Promise<BackupSettings> {
    this.settings = { ...this.settings, autoBackupEnabled: input.autoBackupEnabled };
    return { ...this.settings };
  }

  async recordAttempt(result: BackupAttemptResult): Promise<BackupSettings> {
    this.settings = {
      ...this.settings,
      lastBackupAt: result.status === 'success' ? result.finishedAt : this.settings.lastBackupAt,
      lastBackupStatus: result.status,
      lastBackupError: result.errorMessage,
    };
    return { ...this.settings };
  }
}
