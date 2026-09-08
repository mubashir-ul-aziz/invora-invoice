import { eq } from 'drizzle-orm';

import { EMPTY_CLOUD_BACKUP_SETTINGS, type CloudBackupSettings, type CloudBackupSettingsInput, type CloudStoragePlanId } from '@/domain/cloudBackup/types';
import type { BackupOutcome } from '@/domain/backup/types';

import { getDatabase, getDrizzle } from '../db/client';
import { appSettings } from '../db/schema';
import type { CloudBackupAttemptResult, CloudBackupSettingsRepository } from './CloudBackupSettingsRepository';

/** Same singleton-per-device row convention `SqliteSecurityRepository`/`SqliteBackupSettingsRepository` use. */
const APP_SETTINGS_ID = 'default';

function toSettings(row: typeof appSettings.$inferSelect): CloudBackupSettings {
  return {
    cloudBackupEnabled: row.cloudBackupEnabled === 1,
    planId: (row.cloudBackupPlanId as CloudStoragePlanId | null) ?? null,
    lastCloudBackupAt: row.lastCloudBackupAt ? new Date(row.lastCloudBackupAt).toISOString() : null,
    lastCloudBackupStatus: (row.lastCloudBackupStatus as BackupOutcome | null) ?? null,
    lastCloudBackupError: row.lastCloudBackupError ?? null,
  };
}

/**
 * Real implementation, backed by the same `app_settings` row
 * `SqliteBackupSettingsRepository` (Phase 11) uses — every write here
 * `.set()`s only its five own columns (`cloud_backup_enabled`/
 * `cloud_backup_plan_id`/`last_cloud_backup_at`/`last_cloud_backup_status`/
 * `last_cloud_backup_error`), so it can never clobber App Lock's or Google
 * Drive's columns and vice versa. No Jest coverage — same reason as every
 * other `Sqlite*Repository` in this codebase.
 */
export class SqliteCloudBackupSettingsRepository implements CloudBackupSettingsRepository {
  async getSettings(): Promise<CloudBackupSettings> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID));
    const row = rows[0];
    return row ? toSettings(row) : { ...EMPTY_CLOUD_BACKUP_SETTINGS };
  }

  async saveSettings(input: CloudBackupSettingsInput): Promise<CloudBackupSettings> {
    await this.upsert({ cloudBackupEnabled: input.cloudBackupEnabled ? 1 : 0 });
    return this.getSettings();
  }

  async recordAttempt(result: CloudBackupAttemptResult): Promise<CloudBackupSettings> {
    await this.upsert({
      lastCloudBackupStatus: result.status,
      lastCloudBackupError: result.errorMessage,
      ...(result.status === 'success' ? { lastCloudBackupAt: new Date(result.finishedAt).getTime() } : {}),
    });
    return this.getSettings();
  }

  async recordPlan(planId: CloudStoragePlanId): Promise<CloudBackupSettings> {
    await this.upsert({ cloudBackupPlanId: planId });
    return this.getSettings();
  }

  /** Inserts the singleton row on first use, or updates only the given columns on an existing row — never touches App Lock's or Google Drive's columns either way. */
  private async upsert(values: Record<string, unknown>): Promise<void> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const existing = await db
      .select({ id: appSettings.id })
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID));

    if (existing[0]) {
      await db
        .update(appSettings)
        .set({ ...values, updatedAt: now })
        .where(eq(appSettings.id, APP_SETTINGS_ID));
    } else {
      await db.insert(appSettings).values({
        id: APP_SETTINGS_ID,
        createdAt: now,
        updatedAt: now,
        ...values,
      });
    }
  }
}
