import { realisticBackupTables } from '@/domain/backup/testFixtures';
import { validateBackupPayload } from '@/domain/backup/validation';

import { createBackupHarness } from '../testHarness';

const AT = new Date(2026, 9, 29, 8, 5, 9).getTime();

describe('LocalBackupService.exportBackup', () => {
  it('writes a durable, valid backup file and records it in the history', async () => {
    const { localBackupService, files, logRepository } = createBackupHarness({ seed: realisticBackupTables(), clock: () => AT });

    const entry = await localBackupService.exportBackup();

    expect(entry).toMatchObject({
      status: 'success',
      direction: 'backup',
      trigger: 'manual',
      destination: 'local',
      fileName: 'metriqo-backup-2026-10-29-080509.json',
      counts: expect.objectContaining({ invoices: 1, customers: 1 }),
    });
    expect(files.files.has(entry.fileUri!)).toBe(true);
    expect(entry.sizeBytes).toBe(files.files.get(entry.fileUri!)!.length);
    expect(validateBackupPayload(files.files.get(entry.fileUri!)!).tables).toEqual(realisticBackupTables());
    await expect(logRepository.list()).resolves.toEqual([entry]);
  });

  it('never overwrites an earlier backup made in the same second', async () => {
    const { localBackupService } = createBackupHarness({ clock: () => AT });
    const first = await localBackupService.exportBackup();
    const second = await localBackupService.exportBackup();
    expect(second.fileUri).not.toBe(first.fileUri);
  });

  it('logs a failed export (e.g. storage full) without throwing', async () => {
    const { localBackupService, files } = createBackupHarness();
    files.failNextWrite = new Error('No space left on device');

    const entry = await localBackupService.exportBackup();

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toMatch(/no space/i);
    expect(entry.fileUri).toBeNull();
  });
});

describe('LocalBackupService.delete', () => {
  it('removes the local file and its history row', async () => {
    const { localBackupService, files, logRepository } = createBackupHarness();
    const entry = await localBackupService.exportBackup();

    await localBackupService.delete(entry);

    expect(files.files.size).toBe(0);
    await expect(logRepository.list()).resolves.toEqual([]);
  });
});
