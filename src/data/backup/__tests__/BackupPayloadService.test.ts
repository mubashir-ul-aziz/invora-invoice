import { realisticBackupTables } from '@/domain/backup/testFixtures';
import type { BackupTables } from '@/domain/backup/types';

import { createBackupHarness } from '../testHarness';

const LOGO = { mimeType: 'image/png' as const, base64: 'iVBORw0KGgo=' };
const PICKER_URI = 'file:///cache/ImagePicker/logo.png';

function withLogo(uri: string | null): BackupTables {
  const tables = realisticBackupTables();
  return { ...tables, business: [{ ...tables.business[0], logoUri: uri }] };
}

describe('BackupPayloadService.create', () => {
  it('embeds the logo image itself and drops the device path', async () => {
    const harness = createBackupHarness({ seed: withLogo(PICKER_URI) });
    harness.assets.files.set(PICKER_URI, LOGO);

    const created = await harness.payloads.create();

    expect(created.payload.assets.logo).toEqual(LOGO);
    expect(created.payload.tables.business[0].logoUri).toBeNull();
    expect(created.sourceLogoUri).toBe(PICKER_URI);
    expect(created.content).toContain(LOGO.base64);
  });

  it('still backs up everything else when the logo file is gone', async () => {
    const harness = createBackupHarness({ seed: withLogo('file:///missing.png') });
    const created = await harness.payloads.create();
    expect(created.payload.assets.logo).toBeNull();
    expect(created.counts.invoices).toBe(1);
  });
});

describe('BackupPayloadService.apply — logo restoration', () => {
  it('writes the embedded logo to a new durable file and points the business at it', async () => {
    const source = createBackupHarness({ seed: withLogo(PICKER_URI) });
    source.assets.files.set(PICKER_URI, LOGO);
    const { content } = await source.payloads.create();

    const target = createBackupHarness();
    await target.payloads.apply(target.payloads.inspect(content));

    const [business] = (await target.backupRepository.exportAll()).business;
    expect(business.logoUri).not.toBeNull();
    expect(target.assets.isManaged(business.logoUri!)).toBe(true);
    await expect(target.assets.readImage(business.logoUri!)).resolves.toEqual(LOGO);
  });

  it('deletes the newly written logo again when the restore transaction fails', async () => {
    const source = createBackupHarness({ seed: withLogo(PICKER_URI) });
    source.assets.files.set(PICKER_URI, LOGO);
    const { content } = await source.payloads.create();

    const target = createBackupHarness({ seed: withLogo(null) });
    target.backupRepository.simulateFailureOnRestore = new Error('constraint failed');

    await expect(target.payloads.apply(target.payloads.inspect(content))).rejects.toThrow('constraint failed');
    expect(target.assets.files.size).toBe(0);
    await expect(target.backupRepository.exportAll()).resolves.toEqual(withLogo(null));
  });

  it('removes the previous app-managed logo only after a successful restore', async () => {
    const target = createBackupHarness();
    const oldLogo = await target.assets.writeLogo(LOGO);
    const { content } = await createBackupHarness({ seed: withLogo(null) }).payloads.create();

    await target.payloads.apply(target.payloads.inspect(content), oldLogo);

    await expect(target.assets.exists(oldLogo)).resolves.toBe(false);
  });

  it('never deletes a logo it did not create (e.g. the photo picker’s file)', async () => {
    const target = createBackupHarness();
    target.assets.files.set(PICKER_URI, LOGO);
    const { content } = await createBackupHarness().payloads.create();

    await target.payloads.apply(target.payloads.inspect(content), PICKER_URI);

    await expect(target.assets.exists(PICKER_URI)).resolves.toBe(true);
  });

  it('keeps a version-1 logo path only when that file still exists on this device', async () => {
    const harness = createBackupHarness();
    harness.assets.files.set(PICKER_URI, LOGO);
    const { computeChecksum } = jest.requireActual('@/domain/backup/checksum');
    const v1 = (logoUri: string) => {
      const tables = { ...withLogo(logoUri), appSettings: [] };
      return JSON.stringify({ formatVersion: 1, createdAt: 1, appVersion: '0.9', tables, checksum: computeChecksum(JSON.stringify(tables)) });
    };

    await harness.payloads.apply(harness.payloads.inspect(v1(PICKER_URI)));
    expect((await harness.backupRepository.exportAll()).business[0].logoUri).toBe(PICKER_URI);

    await harness.payloads.apply(harness.payloads.inspect(v1('file:///other-phone/logo.png')));
    expect((await harness.backupRepository.exportAll()).business[0].logoUri).toBeNull();
  });
});
