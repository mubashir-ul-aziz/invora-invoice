import { desc, eq } from 'drizzle-orm';

import { generateLocalId } from '@/lib/id';
import type {
  BackupCounts,
  BackupDestination,
  BackupDirection,
  BackupLogEntry,
  BackupOutcome,
  BackupTrigger,
} from '@/domain/backup/types';

import { getDatabase, getDrizzle } from '../db/client';
import { backupLog } from '../db/schema';
import type { BackupLogEntryInput, BackupLogRepository } from './BackupLogRepository';

function toEntry(row: typeof backupLog.$inferSelect): BackupLogEntry {
  return {
    id: row.id,
    direction: row.direction as BackupDirection,
    trigger: row.trigger as BackupTrigger,
    status: row.status as BackupOutcome,
    destination: row.destination as BackupDestination,
    startedAt: new Date(row.startedAt).toISOString(),
    finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : null,
    formatVersion: row.formatVersion,
    sizeBytes: row.sizeBytes,
    counts: row.itemCounts ? (JSON.parse(row.itemCounts) as BackupCounts) : null,
    errorMessage: row.errorMessage,
  };
}

/** Real implementation, backed by the `backup_log` table. No Jest coverage — same reason as every other `Sqlite*Repository` in this codebase. */
export class SqliteBackupLogRepository implements BackupLogRepository {
  async list(): Promise<BackupLogEntry[]> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(backupLog).orderBy(desc(backupLog.startedAt));
    return rows.map(toEntry);
  }

  async add(entry: BackupLogEntryInput): Promise<BackupLogEntry> {
    await getDatabase();
    const db = getDrizzle();

    const id = generateLocalId('backuplog_');
    await db.insert(backupLog).values({
      id,
      direction: entry.direction,
      trigger: entry.trigger,
      status: entry.status,
      destination: entry.destination,
      startedAt: new Date(entry.startedAt).getTime(),
      finishedAt: entry.finishedAt ? new Date(entry.finishedAt).getTime() : null,
      formatVersion: entry.formatVersion,
      sizeBytes: entry.sizeBytes,
      itemCounts: entry.counts ? JSON.stringify(entry.counts) : null,
      errorMessage: entry.errorMessage,
    });

    const rows = await db.select().from(backupLog).where(eq(backupLog.id, id));
    const row = rows[0];
    if (!row) {
      throw new Error('Failed to read back the backup log entry after creating it.');
    }
    return toEntry(row);
  }
}
