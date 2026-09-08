import type { BackupTables } from '@/domain/backup/types';

import type { BackupRepository } from './BackupRepository';

function emptyTables(): BackupTables {
  return {
    business: [],
    socialLinks: [],
    items: [],
    customers: [],
    invoices: [],
    invoiceItems: [],
    payments: [],
    appSettings: [],
  };
}

function cloneTables(tables: BackupTables): BackupTables {
  return JSON.parse(JSON.stringify(tables)) as BackupTables;
}

/**
 * Mock/testing implementation, following the frontend-first pattern every
 * prior phase used — lets `BackupService`'s orchestration (backup, restore,
 * retention pruning, error handling) be unit-tested without a device. Its
 * `restoreAll()` deliberately mirrors the *safety guarantee*
 * `SqliteBackupRepository` gets for free from a real SQL transaction: it
 * snapshots the current tables first, and rolls back to that exact snapshot
 * if anything fails partway — see `simulateFailureOnRestore` and the
 * "Failed restore leaves existing data intact" test.
 */
export class InMemoryBackupRepository implements BackupRepository {
  private tables: BackupTables;
  /** When set, `restoreAll()` throws this error after (simulated) partial application, then rolls back — see the doc comment above. */
  simulateFailureOnRestore: Error | null = null;

  constructor(seed: BackupTables = emptyTables()) {
    this.tables = cloneTables(seed);
  }

  async exportAll(): Promise<BackupTables> {
    return cloneTables(this.tables);
  }

  async restoreAll(tables: BackupTables): Promise<void> {
    const previous = cloneTables(this.tables);
    // Apply first (like a transaction's writes before COMMIT)...
    this.tables = cloneTables(tables);
    if (this.simulateFailureOnRestore) {
      // ...then, if the simulated failure fires, roll back to the
      // pre-restore snapshot before propagating the error — exactly what a
      // real SQLite `ROLLBACK` gives `SqliteBackupRepository` for free.
      this.tables = previous;
      const error = this.simulateFailureOnRestore;
      throw error;
    }
  }
}
