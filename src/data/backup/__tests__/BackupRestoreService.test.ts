import { computeChecksum } from '@/domain/backup/checksum';
import { realisticBackupTables, tablesWith } from '@/domain/backup/testFixtures';
import { MAX_BACKUP_FILE_BYTES, type BackupTables } from '@/domain/backup/types';
import { BackupValidationError } from '@/domain/backup/validation';

import { createBackupHarness } from '../testHarness';

const LOGO = { mimeType: 'image/jpeg' as const, base64: '/9j/4AAQSkZJRg==' };

function otherDevice(): BackupTables {
  const tables = realisticBackupTables();
  return {
    ...tables,
    business: [{ ...tables.business[0], name: 'Current Shop', currency: 'USD' }],
    customers: [{ ...tables.customers[0], id: 'current-c', name: 'Current Customer' }],
    invoices: [],
    invoiceItems: [],
    payments: [],
  };
}

/** Exports a backup on one "device" and returns its file content. */
async function exportedFile(seed: BackupTables = realisticBackupTables(), logo = false) {
  const source = createBackupHarness({ seed: logo ? { ...seed, business: [{ ...seed.business[0], logoUri: 'file:///pick.jpg' }] } : seed });
  if (logo) source.assets.files.set('file:///pick.jpg', LOGO);
  const entry = await source.localBackupService.exportBackup();
  return source.files.files.get(entry.fileUri!)!;
}

function pick(harness: ReturnType<typeof createBackupHarness>, content: string, sizeBytes: number | null = content.length) {
  const file = { uri: 'file:///cache/DocumentPicker/backup.json', name: 'backup.json', sizeBytes };
  harness.exchange.nextPick = { ...file, content };
  return { kind: 'picked_file' as const, file };
}

describe('BackupRestoreService — export → import round trip', () => {
  it('restores an exported file onto another device exactly: ids, dates, currencies, snapshots, relationships and logo', async () => {
    const content = await exportedFile(realisticBackupTables(), true);
    const target = createBackupHarness({ seed: otherDevice() });

    const prepared = await target.restoreService.prepare(pick(target, content));
    const result = await target.restoreService.restore(prepared);

    expect(result.entry.status).toBe('success');
    const restored = await target.backupRepository.exportAll();
    const { business: [restoredBusiness], ...rest } = restored;
    const { business: [expectedBusiness], ...expectedRest } = realisticBackupTables();
    expect(rest).toEqual(expectedRest);
    expect({ ...restoredBusiness, logoUri: null }).toEqual(expectedBusiness);
    await expect(target.assets.readImage(restoredBusiness.logoUri!)).resolves.toEqual(LOGO);
  });

  it('previews the backup before anything changes', async () => {
    const target = createBackupHarness({ seed: otherDevice() });
    const prepared = await target.restoreService.prepare(pick(target, await exportedFile()));

    expect(prepared.preview).toMatchObject({ businessName: 'Acme Tiles', counts: expect.objectContaining({ invoices: 1, payments: 1 }) });
    expect(target.backupRepository.restoreCalls).toBe(0);
    await expect(target.backupRepository.exportAll()).resolves.toEqual(otherDevice());
  });

  it('discards the picker’s temporary copy after reading it', async () => {
    const target = createBackupHarness();
    const source = pick(target, await exportedFile());
    await target.restoreService.prepare(source);
    expect(target.exchange.discarded).toEqual([source.file.uri]);
  });
});

describe('BackupRestoreService — safety backup', () => {
  it('saves a durable safety backup of the current data first, and keeps it in the history', async () => {
    const target = createBackupHarness({ seed: otherDevice() });
    const prepared = await target.restoreService.prepare(pick(target, await exportedFile()));

    const result = await target.restoreService.restore(prepared);

    expect(result.safetyBackup).toMatchObject({ status: 'success', trigger: 'safety', destination: 'local' });
    expect(result.safetyBackup!.fileName).toMatch(/^metriqo-safety-backup-/);
    const safetyContent = target.files.files.get(result.safetyBackup!.fileUri!)!;
    const undo = await target.restoreService.prepare({ kind: 'local', entry: result.safetyBackup! });
    expect(undo.inspected.payload.tables).toEqual(otherDevice());
    expect(safetyContent).toBeTruthy();
  });

  it('aborts the restore when the safety backup cannot be written — nothing is replaced', async () => {
    const target = createBackupHarness({ seed: otherDevice() });
    const prepared = await target.restoreService.prepare(pick(target, await exportedFile()));
    target.files.failNextWrite = new Error('No space left on device');

    const result = await target.restoreService.restore(prepared);

    expect(result.entry.status).toBe('failure');
    expect(result.entry.errorMessage).toMatch(/safety backup/i);
    expect(result.safetyBackup).toBeNull();
    expect(target.backupRepository.restoreCalls).toBe(0);
    await expect(target.backupRepository.exportAll()).resolves.toEqual(otherDevice());
  });

  it('a restore never erases the device’s backup history or earlier backup files', async () => {
    const target = createBackupHarness({ seed: otherDevice() });
    const earlier = await target.localBackupService.exportBackup();
    const prepared = await target.restoreService.prepare(pick(target, await exportedFile()));

    await target.restoreService.restore(prepared);

    const history = await target.logRepository.list();
    expect(history.map((e) => e.id)).toContain(earlier.id);
    expect(history.filter((e) => e.trigger === 'safety')).toHaveLength(1);
    expect(history.filter((e) => e.direction === 'restore' && e.status === 'success')).toHaveLength(1);
    expect(target.files.files.has(earlier.fileUri!)).toBe(true);
  });
});

describe('BackupRestoreService — failures leave existing data intact', () => {
  it('a failed transaction leaves data and logo untouched and is logged', async () => {
    const target = createBackupHarness({ seed: otherDevice() });
    const prepared = await target.restoreService.prepare(pick(target, await exportedFile(realisticBackupTables(), true)));
    target.backupRepository.simulateFailureOnRestore = new Error('disk I/O error');

    const result = await target.restoreService.restore(prepared);

    expect(result.entry.status).toBe('failure');
    expect(result.entry.errorMessage).toMatch(/not changed.*disk I\/O error/i);
    await expect(target.backupRepository.exportAll()).resolves.toEqual(otherDevice());
    expect(target.assets.files.size).toBe(0);
  });

  it.each([
    ['not JSON', 'definitely not json'],
    ['an unrelated JSON file', JSON.stringify({ name: 'package', version: '1.0.0' })],
    ['a truncated backup', 'TRUNCATE'],
  ])('rejects %s before touching the database', async (_label, content) => {
    const target = createBackupHarness({ seed: otherDevice() });
    const raw = content === 'TRUNCATE' ? (await exportedFile()).slice(0, 200) : content;

    await expect(target.restoreService.prepare(pick(target, raw))).rejects.toBeInstanceOf(BackupValidationError);
    expect(target.backupRepository.restoreCalls).toBe(0);
  });

  it('rejects an oversized file from its reported size, without reading it', async () => {
    const target = createBackupHarness();
    const source = pick(target, '{}', MAX_BACKUP_FILE_BYTES + 1);
    await expect(target.restoreService.prepare(source)).rejects.toMatchObject({ reason: 'too_large' });
  });

  it('rejects a backup with broken relationships', async () => {
    const tables = realisticBackupTables();
    const target = createBackupHarness({ seed: otherDevice() });
    const broken = await exportedFile({ ...tables, customers: [] });
    await expect(target.restoreService.prepare(pick(target, broken))).rejects.toMatchObject({ reason: 'invalid_data' });
  });
});

describe('BackupRestoreService — other sources', () => {
  it('restores a version-1 backup made by an older build', async () => {
    const tables = { ...realisticBackupTables(), appSettings: [{ id: 'default', appLockEnabled: 1 }] };
    const v1 = JSON.stringify({ formatVersion: 1, createdAt: 1, appVersion: '0.9.0', tables, checksum: computeChecksum(JSON.stringify(tables)) });
    const target = createBackupHarness({ seed: otherDevice() });

    const result = await target.restoreService.restore(await target.restoreService.prepare(pick(target, v1)));

    expect(result.entry).toMatchObject({ status: 'success', formatVersion: 1 });
    await expect(target.backupRepository.exportAll()).resolves.toEqual(realisticBackupTables());
  });

  it('restores a Google Drive backup through the same flow (safety backup first)', async () => {
    const harness = createBackupHarness({ seed: realisticBackupTables() });
    await harness.driveService.signIn();
    const driveEntry = await harness.backupService.backupNow('manual');
    await harness.backupRepository.restoreAll(tablesWith());

    const prepared = await harness.restoreService.prepare({ kind: 'google_drive', fileId: driveEntry.remoteFileId!, fileName: driveEntry.fileName });
    const result = await harness.restoreService.restore(prepared);

    expect(result.entry).toMatchObject({ status: 'success', destination: 'google_drive' });
    expect(result.safetyBackup?.status).toBe('success');
    await expect(harness.backupRepository.exportAll()).resolves.toEqual(realisticBackupTables());
  });

  it('restores a local backup straight from the history', async () => {
    const harness = createBackupHarness({ seed: realisticBackupTables() });
    const entry = await harness.localBackupService.exportBackup();
    await harness.backupRepository.restoreAll(otherDevice());

    const result = await harness.restoreService.restore(await harness.restoreService.prepare({ kind: 'local', entry }));

    expect(result.entry.status).toBe('success');
    await expect(harness.backupRepository.exportAll()).resolves.toEqual(realisticBackupTables());
  });

  it('reports a local backup file that was removed from storage', async () => {
    const harness = createBackupHarness();
    const entry = await harness.localBackupService.exportBackup();
    harness.files.files.clear();
    await expect(harness.restoreService.prepare({ kind: 'local', entry })).rejects.toThrow(/no longer on this device/i);
  });
});
