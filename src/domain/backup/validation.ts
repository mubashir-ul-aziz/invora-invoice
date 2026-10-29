import { z } from 'zod';

import { computeChecksum } from './checksum';
import { utf8ByteLength } from './size';
import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  BACKUP_IMAGE_MIME_TYPES,
  BACKUP_TABLE_NAMES,
  MAX_BACKUP_FILE_BYTES,
  MAX_LOGO_BYTES,
  SUPPORTED_BACKUP_FORMAT_VERSIONS,
  countBackupTables,
  type BackupAssets,
  type BackupPayload,
  type BackupPreview,
  type BackupTables,
} from './types';

/** Why a backup file was rejected — surfaced to the UI as a specific, honest message instead of a generic "restore failed". */
export type BackupValidationReason = 'malformed' | 'corrupted' | 'incompatible_version' | 'invalid_data' | 'too_large';

export class BackupValidationError extends Error {
  readonly reason: BackupValidationReason;

  constructor(reason: BackupValidationReason, message: string) {
    super(message);
    this.name = 'BackupValidationError';
    this.reason = reason;
  }
}

const INVOICE_TYPES = ['general', 'quantity', 'weight', 'length', 'area', 'volume', 'time', 'service', 'custom'] as const;

// Columns added after a table's first release are optional here (an older
// backup simply doesn't have them) and default exactly like the SQL
// `*_COLUMN_UPGRADES` backfill does — see `data/db/schema.ts`. Unknown keys
// are dropped by `z.object()`, so nothing outside the known columns can
// reach the database.
const text = z.string();
const id = z.string().min(1).max(200);
const optText = z.string().nullable().optional().transform((v) => v ?? null);
const optNumber = z.number().nullable().optional().transform((v) => v ?? null);
const timestamp = z.number().int().nonnegative();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const percent = z.number().min(0).max(100);
const currency = z.string().trim().min(1).max(10);

const businessRow = z.object({
  id,
  name: z.string().default(''),
  ownerName: optText,
  logoUri: optText,
  phone: optText,
  email: optText,
  website: optText,
  address: optText,
  currency: currency.default('USD'),
  taxId: optText,
  shareSlug: id,
  businessCode: optText,
  invoicePrefix: z.string().max(50).default('INV-'),
  nextInvoiceNumber: z.number().int().min(1).default(1),
  defaultTaxRate: percent.nullable().optional().transform((v) => v ?? null),
  defaultPaymentTermsDays: z.number().int().min(0).nullable().optional().transform((v) => v ?? null),
  // `'minimal'` is the pre-Phase-9 name for `'compact'` — normalized on read by `SqliteBusinessRepository`.
  defaultInvoiceTemplate: z.enum(['classic', 'modern', 'compact', 'minimal']).default('classic'),
  invoiceType: z.enum(INVOICE_TYPES).default('general'),
  customInvoiceFields: optText,
  customUnits: optText,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const socialLinkRow = z.object({
  id,
  businessId: id,
  platform: z.enum(['whatsapp', 'facebook', 'instagram', 'googleMaps']),
  value: text,
});

const itemRow = z.object({
  id,
  name: text,
  description: optText,
  sku: optText,
  unit: optText,
  defaultPrice: z.number().default(0),
  priceMode: z.enum(['unit', 'total']).default('unit'),
  taxRate: percent.nullable().optional().transform((v) => v ?? null),
  weight: optNumber,
  weightUnit: optText,
  length: optNumber,
  width: optNumber,
  height: optNumber,
  lengthUnit: optText,
  invoiceType: z.enum(INVOICE_TYPES).default('general'),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const customerRow = z.object({
  id,
  name: text,
  phone: optText,
  email: optText,
  website: optText,
  address: optText,
  notes: optText,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const invoiceRow = z.object({
  id,
  invoiceNumber: z.string().min(1),
  customerId: id,
  customerName: text,
  invoiceType: z.enum(INVOICE_TYPES),
  issueDate: isoDate,
  dueDate: isoDate.nullable().optional().transform((v) => v ?? null),
  notes: optText,
  terms: optText,
  currency: currency.nullable().optional().transform((v) => v ?? null),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const invoiceItemRow = z.object({
  id,
  invoiceId: id,
  itemId: id.nullable().optional().transform((v) => v ?? null),
  pricingMethod: optText,
  sortOrder: z.number().int().default(0),
  itemName: text,
  description: optText,
  sku: optText,
  quantity: optNumber,
  unit: optText,
  weight: optNumber,
  weightUnit: optText,
  length: optNumber,
  width: optNumber,
  height: optNumber,
  lengthUnit: optText,
  timeUnit: optText,
  priceMode: z.enum(['unit', 'total']).default('unit'),
  unitPrice: z.number(),
  discountPercent: optNumber,
  taxPercent: optNumber,
  subtotal: z.number(),
  discountAmount: z.number(),
  taxAmount: z.number(),
  lineTotal: z.number(),
});

const paymentRow = z.object({
  id,
  invoiceId: id,
  invoiceNumber: z.string().min(1),
  customerId: id,
  customerName: text,
  amount: z.number(),
  paymentDate: isoDate,
  method: z.enum(['cash', 'bank_transfer', 'card', 'paypal', 'other']),
  reference: optText,
  notes: optText,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const ROW_SCHEMAS = {
  business: businessRow,
  socialLinks: socialLinkRow,
  items: itemRow,
  customers: customerRow,
  invoices: invoiceRow,
  invoiceItems: invoiceItemRow,
  payments: paymentRow,
} as const;

/** Human-readable table names for error messages. */
const TABLE_LABELS: Record<keyof typeof ROW_SCHEMAS, string> = {
  business: 'business profile',
  socialLinks: 'social link',
  items: 'item',
  customers: 'customer',
  invoices: 'invoice',
  invoiceItems: 'invoice line',
  payments: 'payment',
};

const anyRows = z.array(z.record(z.string(), z.unknown()));

const v1Envelope = z.object({
  formatVersion: z.literal(1),
  createdAt: z.number(),
  appVersion: z.string(),
  tables: z.object({
    business: anyRows,
    socialLinks: anyRows,
    items: anyRows,
    customers: anyRows,
    invoices: anyRows,
    invoiceItems: anyRows,
    payments: anyRows,
    appSettings: anyRows,
  }),
  checksum: z.string().min(1),
});

const logoAsset = z.object({
  mimeType: z.enum(BACKUP_IMAGE_MIME_TYPES),
  base64: z.string().min(4),
});

const v2Envelope = z.object({
  app: z.literal(BACKUP_APP_ID),
  formatVersion: z.literal(2),
  createdAt: z.number(),
  appVersion: z.string(),
  tables: z.object({
    business: anyRows,
    socialLinks: anyRows,
    items: anyRows,
    customers: anyRows,
    invoices: anyRows,
    invoiceItems: anyRows,
    payments: anyRows,
  }),
  assets: z.object({ logo: logoAsset.nullable() }),
  checksum: z.string().min(1),
});

function malformed(): BackupValidationError {
  return new BackupValidationError(
    'malformed',
    'This file is not a Metriqo backup, or it is missing data Metriqo expects — it may be an unrelated file or a partially written backup.',
  );
}

function invalid(detail: string): BackupValidationError {
  return new BackupValidationError('invalid_data', `This backup contains invalid data (${detail}), so it can't be restored safely.`);
}

/** Exactly what each format version's checksum covers. Version 1 only ever covered `tables`. */
function checksumInput(formatVersion: number, tables: unknown, assets: unknown): string {
  return formatVersion === 1 ? JSON.stringify(tables) : JSON.stringify({ tables, assets });
}

function validateLogo(asset: BackupAssets['logo']): void {
  if (!asset) return;
  const { base64 } = asset;
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw invalid('the embedded logo image is damaged');
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  if ((base64.length / 4) * 3 - padding > MAX_LOGO_BYTES) {
    throw invalid('the embedded logo image is too large');
  }
}

function parseRows(raw: Record<string, unknown[]>): BackupTables {
  const tables: Record<string, unknown[]> = {};
  for (const name of BACKUP_TABLE_NAMES) {
    const schema = ROW_SCHEMAS[name];
    const rows = raw[name] ?? [];
    tables[name] = rows.map((row, index) => {
      const result = schema.safeParse(row);
      if (!result.success) {
        const field = result.error.issues[0]?.path.join('.') || 'a field';
        throw invalid(`${TABLE_LABELS[name]} #${index + 1} has a bad "${field}" value`);
      }
      return result.data;
    });
  }
  return tables as unknown as BackupTables;
}

function assertUnique<T>(rows: T[], key: (row: T) => string, label: string): Set<string> {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = key(row);
    if (seen.has(value)) {
      throw invalid(`duplicate ${label} "${value}"`);
    }
    seen.add(value);
  }
  return seen;
}

/**
 * The relationships the database's foreign keys and unique indexes would
 * enforce anyway — checked here first so a bad file is rejected with a clear
 * reason before the restore transaction even starts, instead of rolling back
 * halfway through with a raw SQLite error.
 */
function validateRelationships(tables: BackupTables): void {
  if (tables.business.length > 1) {
    throw invalid('more than one business profile');
  }
  const businessIds = assertUnique(tables.business, (r) => r.id, 'business id');
  assertUnique(tables.socialLinks, (r) => r.id, 'social link id');
  assertUnique(tables.socialLinks, (r) => `${r.businessId}/${r.platform}`, 'social link platform');
  const itemIds = assertUnique(tables.items, (r) => r.id, 'item id');
  const customerIds = assertUnique(tables.customers, (r) => r.id, 'customer id');
  const invoiceIds = assertUnique(tables.invoices, (r) => r.id, 'invoice id');
  assertUnique(tables.invoices, (r) => r.invoiceNumber, 'invoice number');
  assertUnique(tables.invoiceItems, (r) => r.id, 'invoice line id');
  assertUnique(tables.payments, (r) => r.id, 'payment id');

  for (const link of tables.socialLinks) {
    if (!businessIds.has(link.businessId)) throw invalid('a social link belongs to a missing business');
  }
  for (const inv of tables.invoices) {
    if (!customerIds.has(inv.customerId)) throw invalid(`invoice ${inv.invoiceNumber} refers to a missing customer`);
  }
  for (const line of tables.invoiceItems) {
    if (!invoiceIds.has(line.invoiceId)) throw invalid('an invoice line belongs to a missing invoice');
    if (line.itemId !== null && !itemIds.has(line.itemId)) throw invalid('an invoice line refers to a missing item');
  }
  for (const pay of tables.payments) {
    if (!invoiceIds.has(pay.invoiceId)) throw invalid(`a payment refers to a missing invoice (${pay.invoiceNumber})`);
    if (!customerIds.has(pay.customerId)) throw invalid('a payment refers to a missing customer');
  }
}

/**
 * Version 1 → current shape. `app_settings` is dropped (it's device
 * settings, never restored any more), there is no embedded logo (v1 only had
 * a device path, which the restore keeps only if that file still exists —
 * see `BackupPayloadService.apply()`), and invoices from before the
 * per-invoice `currency` column get the business's currency, exactly like
 * the `ensureInvoiceColumns()` startup backfill would.
 */
function normalizeV1(tables: BackupTables): BackupTables {
  const businessCurrency = tables.business[0]?.currency ?? null;
  if (!businessCurrency) return tables;
  return {
    ...tables,
    invoices: tables.invoices.map((inv) => (inv.currency ? inv : { ...inv, currency: businessCurrency })),
  };
}

/**
 * The one gate every restore must pass through before the database ever sees
 * the data — checks size, structure, format-version compatibility, checksum
 * integrity, every field's type/range, and the relationships between rows,
 * in that order, and throws a typed `BackupValidationError` naming which one
 * failed. Returns the payload in the current (version-2) shape whatever
 * version the file was; `formatVersion` keeps the file's own version for
 * display/logging.
 */
export function validateBackupPayload(raw: string): BackupPayload {
  if (utf8ByteLength(raw) > MAX_BACKUP_FILE_BYTES) {
    throw new BackupValidationError('too_large', 'This file is too large to be a Metriqo backup.');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new BackupValidationError('malformed', 'This backup file is not valid — it may be incomplete or corrupted.');
  }

  const version =
    parsedJson && typeof parsedJson === 'object' ? (parsedJson as { formatVersion?: unknown }).formatVersion : undefined;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw malformed();
  }
  if (!SUPPORTED_BACKUP_FORMAT_VERSIONS.includes(version)) {
    const tooNew = version > BACKUP_FORMAT_VERSION;
    throw new BackupValidationError(
      'incompatible_version',
      tooNew
        ? 'This backup was made by a newer version of Metriqo. Update the app before restoring it.'
        : 'This backup format is no longer supported.',
    );
  }

  let envelope: { createdAt: number; appVersion: string; tables: Record<string, unknown[]>; assets: BackupAssets; checksum: string };
  if (version === 1) {
    const result = v1Envelope.safeParse(parsedJson);
    if (!result.success) throw malformed();
    envelope = { ...result.data, assets: { logo: null } };
  } else {
    const result = v2Envelope.safeParse(parsedJson);
    if (!result.success) throw malformed();
    envelope = result.data;
  }

  // Checksummed over the file's own JSON (not the parsed/defaulted rows), so
  // it matches byte-for-byte what `buildBackupPayload()` hashed.
  const rawFile = parsedJson as { tables: unknown; assets?: unknown };
  if (computeChecksum(checksumInput(version, rawFile.tables, rawFile.assets)) !== envelope.checksum) {
    throw new BackupValidationError(
      'corrupted',
      "This backup file appears to be corrupted or was only partially downloaded/uploaded — its contents don't match its checksum.",
    );
  }

  validateLogo(envelope.assets.logo);
  let tables = parseRows(envelope.tables);
  validateRelationships(tables);
  if (version === 1) {
    tables = normalizeV1(tables);
  }

  return {
    formatVersion: version,
    createdAt: envelope.createdAt,
    appVersion: envelope.appVersion,
    tables,
    assets: envelope.assets,
    checksum: envelope.checksum,
  };
}

/** Builds the current-version envelope around freshly-exported rows and assets — the write-side counterpart to `validateBackupPayload()`. Pure. */
export function buildBackupPayload(
  tables: BackupTables,
  assets: BackupAssets,
  appVersion: string,
  createdAt: number = Date.now(),
): BackupPayload {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt,
    appVersion,
    tables,
    assets,
    checksum: computeChecksum(checksumInput(BACKUP_FORMAT_VERSION, tables, assets)),
  };
}

/** The exact file content for a payload. `app` goes first so the file identifies itself when opened in a text viewer. */
export function serializeBackupPayload(payload: BackupPayload): string {
  return JSON.stringify({ app: BACKUP_APP_ID, ...payload });
}

export function previewBackup(payload: BackupPayload, sizeBytes: number): BackupPreview {
  const business = payload.tables.business[0];
  return {
    formatVersion: payload.formatVersion,
    createdAt: new Date(payload.createdAt).toISOString(),
    appVersion: payload.appVersion,
    businessName: business?.name?.trim() || null,
    counts: countBackupTables(payload.tables),
    hasLogo: payload.assets.logo !== null,
    sizeBytes,
  };
}
