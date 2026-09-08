import { EMPTY_CLOUD_BACKUP_SETTINGS, type CloudBackupSettings, type CloudBackupSettingsInput, type CloudStoragePlanId } from '@/domain/cloudBackup/types';

import type { CloudBackupAttemptResult, CloudBackupSettingsRepository } from './CloudBackupSettingsRepository';

/** Mock/testing implementation — see `SqliteCloudBackupSettingsRepository` for the real one. */
export class InMemoryCloudBackupSettingsRepository implements CloudBackupSettingsRepository {
  private settings: CloudBackupSettings = { ...EMPTY_CLOUD_BACKUP_SETTINGS };

  async getSettings(): Promise<CloudBackupSettings> {
    return { ...this.settings };
  }

  async saveSettings(input: CloudBackupSettingsInput): Promise<CloudBackupSettings> {
    this.settings = { ...this.settings, cloudBackupEnabled: input.cloudBackupEnabled };
    return { ...this.settings };
  }

  async recordAttempt(result: CloudBackupAttemptResult): Promise<CloudBackupSettings> {
    this.settings = {
      ...this.settings,
      lastCloudBackupAt: result.status === 'success' ? result.finishedAt : this.settings.lastCloudBackupAt,
      lastCloudBackupStatus: result.status,
      lastCloudBackupError: result.errorMessage,
    };
    return { ...this.settings };
  }

  async recordPlan(planId: CloudStoragePlanId): Promise<CloudBackupSettings> {
    this.settings = { ...this.settings, planId };
    return { ...this.settings };
  }
}
