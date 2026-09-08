import { eq } from 'drizzle-orm';

import type { SecuritySettings, SecuritySettingsInput } from '@/domain/security/types';

import { getDatabase, getDrizzle } from '../db/client';
import { appSettings } from '../db/schema';
import type { SecurityRepository } from './SecurityRepository';

/** Same singleton-per-device row convention `SqliteBusinessRepository` uses for `business`. */
const APP_SETTINGS_ID = 'default';

function toSettings(row: typeof appSettings.$inferSelect): SecuritySettings {
  return {
    appLockEnabled: row.appLockEnabled === 1,
    biometricUnlockEnabled: row.biometricUnlockEnabled === 1,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** Real implementation, backed by the `app_settings` table. No Jest coverage — Jest can't drive the native SQLite module without a device, same as every other `Sqlite*Repository` in this codebase. */
export class SqliteSecurityRepository implements SecurityRepository {
  async getSettings(): Promise<SecuritySettings | null> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID));
    const row = rows[0];
    return row ? toSettings(row) : null;
  }

  async saveSettings(input: SecuritySettingsInput): Promise<SecuritySettings> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const existing = await db
      .select({ id: appSettings.id, createdAt: appSettings.createdAt })
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID));

    const values = {
      id: APP_SETTINGS_ID,
      appLockEnabled: input.appLockEnabled ? 1 : 0,
      biometricUnlockEnabled: input.biometricUnlockEnabled ? 1 : 0,
      createdAt: existing[0]?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing[0]) {
      await db.update(appSettings).set(values).where(eq(appSettings.id, APP_SETTINGS_ID));
    } else {
      await db.insert(appSettings).values(values);
    }

    const saved = await this.getSettings();
    if (!saved) {
      throw new Error('Failed to read back security settings after saving.');
    }
    return saved;
  }
}
