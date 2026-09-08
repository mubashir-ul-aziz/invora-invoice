import type { BackupTables } from '@/domain/backup/types';

import { getDatabase, getDrizzle } from '../db/client';
import { appSettings, business, customer, invoice, invoiceItem, item, payment, socialLink } from '../db/schema';
import type { BackupRepository } from './BackupRepository';

/** Keeps every `INSERT ... VALUES (...), (...), ...` well under SQLite's bound-parameter limit even for a business with thousands of invoice lines — see "Test: Backup with large data". */
const INSERT_CHUNK_SIZE = 200;

/**
 * Real implementation of `BackupRepository`, operating directly on the raw
 * tables via Drizzle. No Jest coverage — Jest can't drive the native SQLite
 * module without a device, same as every other `Sqlite*Repository` in this
 * codebase; `restoreAll()`'s atomicity/rollback behavior is instead proven
 * once, in plain TypeScript, against `InMemoryBackupRepository`'s equivalent
 * guarantee (see its doc comment) via `BackupService`'s tests.
 */
export class SqliteBackupRepository implements BackupRepository {
  async exportAll(): Promise<BackupTables> {
    await getDatabase();
    const db = getDrizzle();

    const [
      businessRows,
      socialLinkRows,
      itemRows,
      customerRows,
      invoiceRows,
      invoiceItemRows,
      paymentRows,
      appSettingsRows,
    ] = await Promise.all([
      db.select().from(business),
      db.select().from(socialLink),
      db.select().from(item),
      db.select().from(customer),
      db.select().from(invoice),
      db.select().from(invoiceItem),
      db.select().from(payment),
      db.select().from(appSettings),
    ]);

    return {
      business: businessRows,
      socialLinks: socialLinkRows,
      items: itemRows,
      customers: customerRows,
      invoices: invoiceRows,
      invoiceItems: invoiceItemRows,
      payments: paymentRows,
      appSettings: appSettingsRows,
    };
  }

  /**
   * Wraps the entire replace-everything operation in one SQLite transaction
   * (`drizzle-orm/expo-sqlite`'s `db.transaction()`, which runs its callback
   * *synchronously* against the native sync API — see the doc comment
   * below). If any statement throws — a schema mismatch, a constraint
   * violation, the device running out of storage mid-write — the whole
   * transaction rolls back and the database ends up exactly as it was before
   * this call, never partially replaced. This is what makes the "IMPORTANT
   * SAFETY RULE" (`MVP_BUILD_PLAN.md`) hold even for a failure this method
   * itself couldn't anticipate.
   *
   * IMPORTANT: the callback passed to `db.transaction()` must stay a plain,
   * synchronous function (not `async`) and use each query builder's sync
   * `.run()` — the expo-sqlite driver's `transaction()` is fully synchronous
   * under the hood (`BEGIN` / callback / `COMMIT` or `ROLLBACK` with no
   * awaited step in between); an `async` callback would return a `Promise`
   * that the driver does not wait for, so `COMMIT` could run before the
   * writes inside actually finish. See `session.js` in
   * `drizzle-orm/expo-sqlite` for the exact (synchronous) implementation this
   * relies on.
   */
  async restoreAll(tables: BackupTables): Promise<void> {
    await getDatabase();
    const db = getDrizzle();

    db.transaction((tx) => {
      // Children before parents, so foreign-key constraints (PRAGMA
      // foreign_keys = ON, set once in db/client.ts) never reject a delete.
      tx.delete(invoiceItem).run();
      tx.delete(payment).run();
      tx.delete(invoice).run();
      tx.delete(socialLink).run();
      tx.delete(customer).run();
      tx.delete(item).run();
      tx.delete(business).run();
      tx.delete(appSettings).run();

      // Parents before children, mirroring the deletes above in reverse.
      insertInChunks(tables.business, (chunk) => tx.insert(business).values(chunk).run());
      insertInChunks(tables.appSettings, (chunk) => tx.insert(appSettings).values(chunk).run());
      insertInChunks(tables.customers, (chunk) => tx.insert(customer).values(chunk).run());
      insertInChunks(tables.items, (chunk) => tx.insert(item).values(chunk).run());
      insertInChunks(tables.socialLinks, (chunk) => tx.insert(socialLink).values(chunk).run());
      insertInChunks(tables.invoices, (chunk) => tx.insert(invoice).values(chunk).run());
      insertInChunks(tables.invoiceItems, (chunk) => tx.insert(invoiceItem).values(chunk).run());
      insertInChunks(tables.payments, (chunk) => tx.insert(payment).values(chunk).run());
    });
  }
}

/**
 * `db.insert(table).values([])` (an empty array) throws in Drizzle rather
 * than being a no-op, and a single `VALUES` list with thousands of rows can
 * exceed SQLite's bound-parameter ceiling — so this both guards the
 * empty-table case and splits large tables into fixed-size batches. `insertChunk`
 * closes over the transaction and target table, so this helper stays
 * table-shape-agnostic (no generic constraint gymnastics against Drizzle's
 * table/transaction types) while every call site above still runs inside the
 * one enclosing `db.transaction()`.
 */
function insertInChunks<TRow>(rows: TRow[], insertChunk: (chunk: TRow[]) => void): void {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    insertChunk(rows.slice(i, i + INSERT_CHUNK_SIZE));
  }
}
