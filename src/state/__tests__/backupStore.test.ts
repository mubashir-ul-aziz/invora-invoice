import { createBackupHarness } from '@/data/backup/testHarness';
import { realisticBackupTables } from '@/domain/backup/testFixtures';
import type { BackupTables } from '@/domain/backup/types';

import { createBackupStore } from '../backupStore';

function makeStore(opts: { clock?: () => number; seed?: BackupTables } = {}) {
  const harness = createBackupHarness({ clock: opts.clock, seed: opts.seed });
  const onRestored = jest.fn(async () => undefined);
  const store = createBackupStore({
    backupService: harness.backupService,
    localBackupService: harness.localBackupService,
    restoreService: harness.restoreService,
    exchange: harness.exchange,
    driveService: harness.driveService,
    settingsRepository: harness.settingsRepository,
    logRepository: harness.logRepository,
    now: opts.clock ?? Date.now,
    onRestored,
  });
  return { store, onRestored, ...harness };
}

describe('backupStore — Google Drive', () => {
  it('load() populates settings, sign-in state, account email and history', async () => {
    const { store, driveService } = makeStore();
    await driveService.signIn();
    await store.getState().load();
    expect(store.getState()).toMatchObject({ status: 'ready', signedIn: true, accountEmail: 'owner@example.com', history: [] });
  });

  it('signIn() flips signedIn, loads the email and remote backups', async () => {
    const { store } = makeStore();
    await expect(store.getState().signIn()).resolves.toBe(true);
    expect(store.getState()).toMatchObject({ signedIn: true, accountEmail: 'owner@example.com', remoteListLoaded: true });
  });

  it('signIn() reports failure without throwing', async () => {
    const { store, driveService } = makeStore();
    driveService.simulateOffline = true;
    await expect(store.getState().signIn()).resolves.toBe(false);
    expect(store.getState().error).toMatch(/offline/i);
  });

  it('signOut() clears the connection and remote backups', async () => {
    const { store } = makeStore();
    await store.getState().signIn();
    await store.getState().signOut();
    expect(store.getState()).toMatchObject({ signedIn: false, accountEmail: null, remoteBackups: [] });
  });

  it('backupNow() adds a Drive entry to the history with actions', async () => {
    const { store } = makeStore();
    await store.getState().signIn();

    const entry = await store.getState().backupNow();

    expect(entry.status).toBe('success');
    expect(store.getState().settings.lastBackupStatus).toBe('success');
    const item = store.getState().items.find((candidate) => candidate.key === entry.id)!;
    expect(item).toMatchObject({ location: 'google_drive', actions: { share: true, restore: true, delete: true } });
  });

  it('backupNow() on failure surfaces the error without throwing', async () => {
    const { store } = makeStore();
    const entry = await store.getState().backupNow();
    expect(entry.status).toBe('failure');
    expect(store.getState().error).toMatch(/sign in/i);
    expect(store.getState().busy).toBeNull();
  });
});

describe('backupStore — export, share and delete', () => {
  it('exportBackup() saves a durable local backup that appears in the history', async () => {
    const { store, files } = makeStore({ seed: realisticBackupTables() });

    const entry = await store.getState().exportBackup();

    expect(entry.status).toBe('success');
    expect(files.files.has(entry.fileUri!)).toBe(true);
    expect(store.getState().items[0]).toMatchObject({ key: entry.id, title: 'Exported file', location: 'local' });
  });

  it('shareItem() opens the share sheet for the local file itself', async () => {
    const { store, exchange } = makeStore();
    const entry = await store.getState().exportBackup();
    await store.getState().shareItem(store.getState().items[0]);
    expect(exchange.sharedFiles).toEqual([entry.fileUri]);
  });

  it('shareItem() downloads a Drive backup into a temporary file to share it', async () => {
    const { store, exchange } = makeStore();
    await store.getState().signIn();
    const entry = await store.getState().backupNow();
    await store.getState().shareItem(store.getState().items.find((i) => i.key === entry.id)!);
    expect(exchange.sharedContents).toHaveLength(1);
    expect(exchange.sharedContents[0].fileName).toBe(entry.fileName);
  });

  it('saveItemToDevice() reports "saved" only when the copy was written', async () => {
    const { store, exchange } = makeStore();
    await store.getState().exportBackup();
    const item = store.getState().items[0];

    await expect(store.getState().saveItemToDevice(item)).resolves.toBe('saved');
    exchange.saveOutcome = 'cancelled';
    await expect(store.getState().saveItemToDevice(item)).resolves.toBe('cancelled');
    expect(exchange.savedCopies).toHaveLength(1);
  });

  it('deleteItem() removes a local file and its row', async () => {
    const { store, files } = makeStore();
    await store.getState().exportBackup();
    await store.getState().deleteItem(store.getState().items[0]);
    expect(files.files.size).toBe(0);
    expect(store.getState().items).toEqual([]);
  });

  it('deleteItem() removes a Drive file and its row', async () => {
    const { store, driveService } = makeStore();
    await store.getState().signIn();
    const entry = await store.getState().backupNow();
    await store.getState().deleteItem(store.getState().items.find((i) => i.key === entry.id)!);
    await expect(driveService.listBackups()).resolves.toEqual([]);
    expect(store.getState().items).toEqual([]);
  });
});

describe('backupStore — import and restore', () => {
  async function exportedContent() {
    const source = createBackupHarness({ seed: realisticBackupTables() });
    const entry = await source.localBackupService.exportBackup();
    return source.files.files.get(entry.fileUri!)!;
  }

  it('importBackup() returns cancelled when the picker is dismissed', async () => {
    const { store } = makeStore();
    await expect(store.getState().importBackup()).resolves.toEqual({ status: 'cancelled' });
    expect(store.getState().busy).toBeNull();
  });

  it('importBackup() rejects an invalid file with its reason and changes nothing', async () => {
    const { store, exchange, backupRepository } = makeStore();
    exchange.nextPick = { uri: 'file:///x.json', name: 'x.json', sizeBytes: 3, content: '{}' };

    const outcome = await store.getState().importBackup();

    expect(outcome.status).toBe('invalid');
    expect(store.getState().pendingRestore).toBeNull();
    expect(backupRepository.restoreCalls).toBe(0);
  });

  it('import → preview → confirm replaces the data, logs a safety backup and refreshes the app', async () => {
    const { store, exchange, backupRepository, onRestored } = makeStore();
    const content = await exportedContent();
    exchange.nextPick = { uri: 'file:///b.json', name: 'b.json', sizeBytes: content.length, content };

    const outcome = await store.getState().importBackup();
    expect(outcome).toMatchObject({ status: 'ready', preview: { businessName: 'Acme Tiles' } });
    expect(backupRepository.restoreCalls).toBe(0);

    const result = await store.getState().confirmRestore();

    expect(result?.entry.status).toBe('success');
    await expect(backupRepository.exportAll()).resolves.toEqual(realisticBackupTables());
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(store.getState().items.map((i) => i.title)).toEqual(expect.arrayContaining(['Restore from file', 'Safety backup']));
    expect(store.getState().pendingRestore).toBeNull();
  });

  it('cancelRestore() drops the pending backup without restoring', async () => {
    const { store, exchange, backupRepository } = makeStore();
    const content = await exportedContent();
    exchange.nextPick = { uri: 'file:///b.json', name: 'b.json', sizeBytes: null, content };
    await store.getState().importBackup();

    store.getState().cancelRestore();

    await expect(store.getState().confirmRestore()).resolves.toBeNull();
    expect(backupRepository.restoreCalls).toBe(0);
  });

  it('a failed restore does not refresh the app and surfaces the error', async () => {
    const { store, exchange, backupRepository, onRestored } = makeStore();
    const content = await exportedContent();
    exchange.nextPick = { uri: 'file:///b.json', name: 'b.json', sizeBytes: null, content };
    await store.getState().importBackup();
    backupRepository.simulateFailureOnRestore = new Error('boom');

    const result = await store.getState().confirmRestore();

    expect(result?.entry.status).toBe('failure');
    expect(onRestored).not.toHaveBeenCalled();
    expect(store.getState().error).toMatch(/not changed/i);
  });

  it('restores straight from a history item', async () => {
    const { store, backupRepository } = makeStore({ seed: realisticBackupTables() });
    await store.getState().exportBackup();
    await backupRepository.restoreAll({ ...realisticBackupTables(), payments: [] });

    await store.getState().prepareRestoreFromItem(store.getState().items[0]);
    const result = await store.getState().confirmRestore();

    expect(result?.entry.status).toBe('success');
    await expect(backupRepository.exportAll()).resolves.toEqual(realisticBackupTables());
  });
});

describe('backupStore — runAutomaticBackupIfDue', () => {
  it('does nothing when auto-backup is disabled', async () => {
    const { store, driveService, logRepository } = makeStore();
    await driveService.signIn();
    await store.getState().load();

    await store.getState().runAutomaticBackupIfDue();

    await expect(logRepository.list()).resolves.toEqual([]);
  });

  it('does nothing when not signed in, even if enabled', async () => {
    const { store, logRepository } = makeStore();
    await store.getState().load();
    await store.getState().setAutoBackupEnabled(true);

    await store.getState().runAutomaticBackupIfDue();

    await expect(logRepository.list()).resolves.toEqual([]);
  });

  it('runs a backup when enabled, signed in, and never backed up before', async () => {
    const { store, driveService, logRepository } = makeStore();
    await driveService.signIn();
    await store.getState().load();
    await store.getState().setAutoBackupEnabled(true);

    await store.getState().runAutomaticBackupIfDue();

    const [entry] = await logRepository.list();
    expect(entry).toMatchObject({ trigger: 'automatic', destination: 'google_drive', status: 'success' });
    expect(store.getState().settings.lastBackupStatus).toBe('success');
  });

  it('does not run again if the last backup was recent', async () => {
    const { store, driveService, logRepository } = makeStore();
    await driveService.signIn();
    await store.getState().load();
    await store.getState().setAutoBackupEnabled(true);
    await store.getState().runAutomaticBackupIfDue();

    await store.getState().runAutomaticBackupIfDue();

    await expect(logRepository.list()).resolves.toHaveLength(1);
  });

  it('runs again once the last backup is old enough', async () => {
    let now = Date.parse('2026-01-01T00:00:00.000Z');
    const { store, driveService, logRepository } = makeStore({ clock: () => now });
    await driveService.signIn();
    await store.getState().load();
    await store.getState().setAutoBackupEnabled(true);
    await store.getState().runAutomaticBackupIfDue();

    now += 25 * 60 * 60 * 1000; // > 24h later
    await store.getState().runAutomaticBackupIfDue();

    await expect(logRepository.list()).resolves.toHaveLength(2);
  });
});
