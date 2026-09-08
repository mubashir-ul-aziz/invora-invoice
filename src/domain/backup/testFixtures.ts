import type { BackupTables } from './types';

/**
 * Shared test-only helper for building `BackupTables` fixtures. Real rows
 * are Drizzle's full `$inferSelect` shape (every column), which is exactly
 * right for production code but needlessly verbose for tests that only care
 * about a couple of fields (e.g. `id`/`name`) — so overrides here are
 * intentionally loose and cast to `BackupTables` at the boundary, the same
 * way a hand-rolled JSON fixture would be in a real backup file.
 */
export function emptyBackupTables(): BackupTables {
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

export function tablesWith(overrides: Partial<Record<keyof BackupTables, unknown[]>> = {}): BackupTables {
  return { ...emptyBackupTables(), ...overrides } as BackupTables;
}
