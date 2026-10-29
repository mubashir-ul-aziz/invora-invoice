import { computeChecksum } from '../checksum';
import { emptyBackupTables, realisticBackupTables } from '../testFixtures';
import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION, EMPTY_BACKUP_ASSETS, MAX_BACKUP_FILE_BYTES, type BackupTables } from '../types';
import {
  BackupValidationError,
  buildBackupPayload,
  previewBackup,
  serializeBackupPayload,
  validateBackupPayload,
} from '../validation';

const LOGO = { mimeType: 'image/png' as const, base64: 'iVBORw0KGgo=' };

function file(tables: BackupTables = realisticBackupTables(), assets = EMPTY_BACKUP_ASSETS): string {
  return serializeBackupPayload(buildBackupPayload(tables, assets, '1.0.0', 1000));
}

/** Re-signs an edited payload so a test isolates the check after the checksum. */
function resign(edit: (json: { tables: Record<string, Record<string, unknown>[]>; assets: unknown }) => void): string {
  const json = JSON.parse(file());
  edit(json);
  json.checksum = computeChecksum(JSON.stringify({ tables: json.tables, assets: json.assets }));
  return JSON.stringify(json);
}

/** A version-1 file exactly as older builds wrote it: `app_settings` included, logo only a path, no `app` marker. */
function v1File(tables: Record<string, unknown[]>): string {
  return JSON.stringify({ formatVersion: 1, createdAt: 500, appVersion: '0.9.0', tables, checksum: computeChecksum(JSON.stringify(tables)) });
}

function reasonOf(raw: string): string | undefined {
  try {
    validateBackupPayload(raw);
    return undefined;
  } catch (err) {
    return (err as BackupValidationError).reason;
  }
}

describe('buildBackupPayload / validateBackupPayload round-trip', () => {
  it('round-trips a backup with no data', () => {
    const restored = validateBackupPayload(file(emptyBackupTables()));
    expect(restored.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(restored.tables).toEqual(emptyBackupTables());
  });

  it('round-trips every field of a realistic dataset unchanged — ids, dates, currencies and invoice snapshots', () => {
    const tables = realisticBackupTables();
    const restored = validateBackupPayload(file(tables));
    expect(restored.tables).toEqual(tables);
    expect(restored.tables.invoices[0].currency).toBe('GBP');
    expect(restored.tables.invoiceItems[0].itemName).toBe('Tile (snapshot name)');
  });

  it('round-trips the embedded logo and marks the file as a Metriqo backup', () => {
    const raw = file(realisticBackupTables(), { logo: LOGO });
    expect(JSON.parse(raw).app).toBe(BACKUP_APP_ID);
    expect(validateBackupPayload(raw).assets.logo).toEqual(LOGO);
  });

  it('round-trips a large backup', () => {
    const base = realisticBackupTables();
    const customers = Array.from({ length: 500 }, (_, i) => ({ ...base.customers[0], id: `c${i}` }));
    const invoices = Array.from({ length: 2000 }, (_, i) => ({ ...base.invoices[0], id: `inv${i}`, invoiceNumber: `N-${i}`, customerId: `c${i % 500}` }));
    const restored = validateBackupPayload(file({ ...base, customers, invoices, invoiceItems: [], payments: [] }));
    expect(restored.tables.customers).toHaveLength(500);
    expect(restored.tables.invoices).toHaveLength(2000);
  });

  it('drops keys that are not known columns (e.g. a hand-added subscription table or plan field)', () => {
    const raw = resign((json) => {
      (json.tables as Record<string, unknown>).subscriptionState = [{ id: 'default', plan: 'business', isActive: 1 }];
      json.tables.business[0].plan = 'business';
    });
    const restored = validateBackupPayload(raw);
    expect(restored.tables).not.toHaveProperty('subscriptionState');
    expect(restored.tables.business[0]).not.toHaveProperty('plan');
  });
});

describe('validateBackupPayload — version 1 backups', () => {
  it('restores a version-1 backup: drops app_settings and backfills missing invoice currencies from the business', () => {
    const tables = realisticBackupTables();
    const { currency: _dropped, ...legacyInvoice } = tables.invoices[0];
    const raw = v1File({
      ...tables,
      invoices: [legacyInvoice],
      appSettings: [{ id: 'default', appLockEnabled: 1, autoBackupEnabled: 1 }],
    });

    const restored = validateBackupPayload(raw);

    expect(restored.formatVersion).toBe(1);
    expect(restored.tables).not.toHaveProperty('appSettings');
    expect(restored.tables.invoices[0].currency).toBe('EUR');
    expect(restored.assets.logo).toBeNull();
  });

  it('fills columns added after version 1 with the same defaults the database migration uses', () => {
    const tables = realisticBackupTables();
    const { priceMode: _p, weightUnit: _w, lengthUnit: _l, ...oldItem } = tables.items[0];
    const restored = validateBackupPayload(v1File({ ...tables, items: [oldItem], appSettings: [] }));
    expect(restored.tables.items[0]).toMatchObject({ priceMode: 'unit', weightUnit: null, lengthUnit: null });
  });

  it('still detects a corrupted version-1 file', () => {
    const raw = JSON.parse(v1File({ ...realisticBackupTables(), appSettings: [] }));
    raw.tables.customers[0].name = 'Tampered';
    expect(reasonOf(JSON.stringify(raw))).toBe('corrupted');
  });
});

describe('validateBackupPayload — rejecting bad input', () => {
  it('rejects a file that is not JSON at all (malformed)', () => {
    expect(reasonOf('not json at all {{{')).toBe('malformed');
  });

  it('rejects JSON missing the expected shape (malformed)', () => {
    expect(reasonOf(JSON.stringify({ hello: 'world' }))).toBe('malformed');
  });

  it('rejects a version-2 file without the Metriqo marker (an unrelated JSON file)', () => {
    const json = JSON.parse(file());
    delete json.app;
    expect(reasonOf(JSON.stringify(json))).toBe('malformed');
  });

  it('rejects a corrupted backup (checksum mismatch)', () => {
    const json = JSON.parse(file());
    json.tables.customers[0].name = 'Injected';
    expect(reasonOf(JSON.stringify(json))).toBe('corrupted');
  });

  it('rejects a swapped logo (the checksum covers assets too)', () => {
    const json = JSON.parse(file(realisticBackupTables(), { logo: LOGO }));
    json.assets.logo.base64 = 'AAAAAAAA';
    expect(reasonOf(JSON.stringify(json))).toBe('corrupted');
  });

  it('rejects a partially-written/interrupted backup file (truncated JSON)', () => {
    const full = file();
    expect(reasonOf(full.slice(0, full.length - 30))).toBe('malformed');
  });

  it('rejects a file over the size limit before parsing it', () => {
    expect(reasonOf('x'.repeat(MAX_BACKUP_FILE_BYTES + 1))).toBe('too_large');
  });

  it('rejects a newer, incompatible format version', () => {
    const json = JSON.parse(file());
    json.formatVersion = BACKUP_FORMAT_VERSION + 1;
    expect(reasonOf(JSON.stringify(json))).toBe('incompatible_version');
  });

  it('rejects an old, no-longer-supported format version', () => {
    const json = JSON.parse(file());
    json.formatVersion = 0;
    expect(reasonOf(JSON.stringify(json))).toBe('incompatible_version');
  });

  it.each([
    ['a non-numeric price', (j: any) => (j.tables.invoiceItems[0].unitPrice = '10')],
    ['an impossible date', (j: any) => (j.tables.invoices[0].issueDate = '01/10/2026')],
    ['an unknown payment method', (j: any) => (j.tables.payments[0].method = 'bitcoin')],
    ['a tax rate over 100%', (j: any) => (j.tables.business[0].defaultTaxRate = 250)],
    ['a missing required id', (j: any) => delete j.tables.customers[0].id],
    ['a damaged logo image', (j: any) => (j.assets = { logo: { mimeType: 'image/png', base64: '***' } })],
    ['an unsupported logo type', (j: any) => (j.assets = { logo: { mimeType: 'image/svg+xml', base64: 'AAAA' } })],
  ])('rejects invalid field values: %s', (_label, edit) => {
    const reason = reasonOf(resign(edit));
    expect(['invalid_data', 'malformed']).toContain(reason);
  });

  it.each([
    ['an invoice for a missing customer', (j: any) => (j.tables.invoices[0].customerId = 'ghost')],
    ['a line on a missing invoice', (j: any) => (j.tables.invoiceItems[0].invoiceId = 'ghost')],
    ['a line pointing at a missing item', (j: any) => (j.tables.invoiceItems[0].itemId = 'ghost')],
    ['a payment for a missing invoice', (j: any) => (j.tables.payments[0].invoiceId = 'ghost')],
    ['a social link for a missing business', (j: any) => (j.tables.socialLinks[0].businessId = 'ghost')],
    ['duplicate invoice numbers', (j: any) => j.tables.invoices.push({ ...j.tables.invoices[0], id: 'inv2' })],
    ['duplicate customer ids', (j: any) => j.tables.customers.push({ ...j.tables.customers[0] })],
    ['two business profiles', (j: any) => j.tables.business.push({ ...j.tables.business[0], id: 'second' })],
  ])('rejects broken relationships: %s', (_label, edit) => {
    expect(reasonOf(resign(edit))).toBe('invalid_data');
  });

  it('accepts a line whose catalog item was deleted (itemId null)', () => {
    expect(reasonOf(resign((j: any) => (j.tables.invoiceItems[0].itemId = null)))).toBeUndefined();
  });
});

describe('previewBackup', () => {
  it('summarizes the business, counts and logo without the device path', () => {
    const payload = validateBackupPayload(file(realisticBackupTables(), { logo: LOGO }));
    expect(previewBackup(payload, 1234)).toEqual({
      formatVersion: BACKUP_FORMAT_VERSION,
      createdAt: new Date(1000).toISOString(),
      appVersion: '1.0.0',
      businessName: 'Acme Tiles',
      counts: { business: 1, socialLinks: 1, items: 1, customers: 1, invoices: 1, invoiceItems: 1, payments: 1 },
      hasLogo: true,
      sizeBytes: 1234,
    });
  });
});
