import { BACKUP_FORMAT_VERSION } from '../types';
import { BackupValidationError, buildBackupPayload, validateBackupPayload } from '../validation';
import { emptyBackupTables, tablesWith } from '../testFixtures';

describe('buildBackupPayload / validateBackupPayload round-trip', () => {
  it('round-trips a backup with no data', () => {
    const payload = buildBackupPayload(emptyBackupTables(), '1.0.0', 1000);
    const restored = validateBackupPayload(JSON.stringify(payload));
    expect(restored).toEqual(payload);
    expect(restored.tables.business).toEqual([]);
  });

  it('round-trips a large backup', () => {
    const tables = tablesWith({
      customers: Array.from({ length: 500 }, (_, i) => ({ id: `c${i}`, name: `Customer ${i}` })),
      invoices: Array.from({ length: 2000 }, (_, i) => ({ id: `inv${i}`, invoiceNumber: `INV-${i}` })),
    });
    const payload = buildBackupPayload(tables, '1.0.0');
    const restored = validateBackupPayload(JSON.stringify(payload));
    expect(restored.tables.customers).toHaveLength(500);
    expect(restored.tables.invoices).toHaveLength(2000);
  });
});

describe('validateBackupPayload — rejecting bad input', () => {
  it('rejects a file that is not JSON at all (malformed)', () => {
    expect(() => validateBackupPayload('not json at all {{{')).toThrow(BackupValidationError);
    try {
      validateBackupPayload('not json at all {{{');
    } catch (err) {
      expect((err as BackupValidationError).reason).toBe('malformed');
    }
  });

  it('rejects JSON missing the expected shape (malformed)', () => {
    expect(() => validateBackupPayload(JSON.stringify({ hello: 'world' }))).toThrow(BackupValidationError);
    try {
      validateBackupPayload(JSON.stringify({ hello: 'world' }));
    } catch (err) {
      expect((err as BackupValidationError).reason).toBe('malformed');
    }
  });

  it('rejects a corrupted backup (checksum mismatch)', () => {
    const payload = buildBackupPayload(emptyBackupTables(), '1.0.0');
    const tampered = { ...payload, tables: { ...payload.tables, business: [{ id: 'injected' }] } };
    expect(() => validateBackupPayload(JSON.stringify(tampered))).toThrow(BackupValidationError);
    try {
      validateBackupPayload(JSON.stringify(tampered));
    } catch (err) {
      expect((err as BackupValidationError).reason).toBe('corrupted');
    }
  });

  it('rejects a partially-written/interrupted backup file (truncated JSON)', () => {
    const payload = buildBackupPayload(emptyBackupTables(), '1.0.0');
    const full = JSON.stringify(payload);
    const truncated = full.slice(0, full.length - 30);
    expect(() => validateBackupPayload(truncated)).toThrow(BackupValidationError);
  });

  it('rejects a newer, incompatible format version', () => {
    const payload = buildBackupPayload(emptyBackupTables(), '1.0.0');
    // Only `formatVersion` changes — checksum stays valid over the same
    // `tables`, isolating this test to the version check.
    const fromTheFuture = { ...payload, formatVersion: BACKUP_FORMAT_VERSION + 1 };
    expect(() => validateBackupPayload(JSON.stringify(fromTheFuture))).toThrow(BackupValidationError);
    try {
      validateBackupPayload(JSON.stringify(fromTheFuture));
    } catch (err) {
      expect((err as BackupValidationError).reason).toBe('incompatible_version');
    }
  });

  it('rejects an old, no-longer-supported format version', () => {
    const payload = buildBackupPayload(emptyBackupTables(), '1.0.0');
    const ancient = { ...payload, formatVersion: 0 };
    try {
      validateBackupPayload(JSON.stringify(ancient));
      fail('expected validateBackupPayload to throw');
    } catch (err) {
      expect((err as BackupValidationError).reason).toBe('incompatible_version');
    }
  });
});
