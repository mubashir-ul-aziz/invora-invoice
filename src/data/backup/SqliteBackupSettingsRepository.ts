import { eq } from 'drizzle-orm';

import { EMPTY_BACKUP_SETTINGS, type BackupOutcome, type BackupSettings, type BackupSettingsInput } from '@/domain/backup/types';

import { getDatabase, getDrizzle } from '../db/client';
import { appSettings } from '../db/schema';
import type { BackupAttemptResult, BackupSettingsRepository } from './BackupSettingsRepository';

/** Same singleton-per-device row convention `SqliteSecurityRepository` uses. */
const APP_SETTINGS_ID = 'default';

function toSettings(row: typeof appSettings.$inferSelect): BackupSettings {
  return {
    autoBackupEnabled: row.autoBackupEnabled === 1,
    lastBackupAt: row.lastBackupAt ? new Date(row.lastBackupAt).toISOString() : null,
    lastBackupStatus: (row.lastBackupStatus as BackupOutcome | null) ?? null,
    lastBackupError: row.lastBackupError ?? null,
  };
}

/**
 * Real implementation, backed by the same `app_settings` row
 * `SqliteSecurityRepository` uses — every write here `.set()`s only the four
 * backup-owned columns (`auto_backup_enabled`/`last_backup_at`/
 * `last_backup_status`/`last_backup_error`), so it can never clobber
 * `app_lock_enabled`/`biometric_unlock_enabled` and vice versa, the same
 * "does not clobber" guarantee Phase 2 established for `business`. No Jest
 * coverage — same reason as every other `Sqlite*Repository` in this
 * codebase.
 */
export class SqliteBackupSettingsRepository implements BackupSettingsRepository {
  async getSettings(): Promise<BackupSettings> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID));
    const row = rows[0];
    return row ? toSettings(row) : { ...EMPTY_BACKUP_SETTINGS };
  }

  async saveSettings(input: BackupSettingsInput): Promise<BackupSettings> {
    await this.upsert({ autoBackupEnabled: input.autoBackupEnabled ? 1 : 0 });
    return this.getSettings();
  }

  async recordAttempt(result: BackupAttemptResult): Promise<BackupSettings> {
    await this.upsert({
      lastBackupStatus: result.status,
      lastBackupError: result.errorMessage,
      ...(result.status === 'success' ? { lastBackupAt: new Date(result.finishedAt).getTime() } : {}),
    });
    return this.getSettings();
  }

  /** Inserts the singleton row on first use (with every other column at its schema default), or updates only the given columns on an existing row — never touches App Lock's columns either way. */
  private async upsert(values: Record<string, unknown>): Promise<void> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const existing = await db
      .select({ id: appSettings.id, createdAt: appSettings.createdAt })
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
