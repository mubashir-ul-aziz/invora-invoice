import { generateLocalId } from '@/lib/id';
import type { BackupLogEntry } from '@/domain/backup/types';

import type { BackupLogEntryInput, BackupLogRepository } from './BackupLogRepository';

/** Mock/testing implementation — see `SqliteBackupLogRepository` for the real one. */
export class InMemoryBackupLogRepository implements BackupLogRepository {
  private entries: BackupLogEntry[] = [];

  async list(): Promise<BackupLogEntry[]> {
    return [...this.entries].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  }

  async add(entry: BackupLogEntryInput): Promise<BackupLogEntry> {
    const saved: BackupLogEntry = { id: generateLocalId('backuplog_'), ...entry };
    this.entries.push(saved);
    return saved;
  }
}
