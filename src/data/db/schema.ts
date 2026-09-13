import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * `business` is a singleton-per-device table (Phase 1 built the Digital
 * Business Card fields; Phase 2 extends the *same* table/entity with
 * invoice-facing columns instead of introducing a second Business entity).
 * It is modelled as a normal table with an id, rather than a hard-coded
 * singleton row, so future phases can keep extending it without a schema
 * shape-change.
 */
export const business = sqliteTable('business', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  ownerName: text('owner_name'),
  logoUri: text('logo_uri'),
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  address: text('address'),
  currency: text('currency').notNull().default('USD'),
  taxId: text('tax_id'),
  /** Stable random slug used to build the local share-link / QR payload. */
  shareSlug: text('share_slug').notNull(),
  /**
   * Unique 6-digit business id (e.g. `"483920"`), generated once when this
   * row is first created (`generateBusinessCode()`) and never reassigned
   * afterwards — it's the fixed half of every invoice number this business
   * issues (see `formatNextInvoiceNumber` in `domain/business/types.ts`).
   * Nullable only so pre-existing installs from before this column existed
   * (backfilled via `BUSINESS_COLUMN_UPGRADES`/`ensureBusinessColumns()` in
   * `db/client.ts`) can have a code generated and persisted lazily, the next
   * time `SqliteBusinessRepository` reads or writes the row, rather than
   * failing a NOT NULL migration.
   */
  businessCode: text('business_code'),
  // --- Phase 2 (Business / Company + Invoice Settings) additions ---
  invoicePrefix: text('invoice_prefix').notNull().default('INV-'),
  nextInvoiceNumber: integer('next_invoice_number').notNull().default(1),
  /** Percentage (0–100), null = no default tax applied to new invoices. */
  defaultTaxRate: real('default_tax_rate'),
  /** Days until due; 0 = due on receipt; null = no default. */
  defaultPaymentTermsDays: integer('default_payment_terms_days'),
  /**
   * Phase 9 renamed the third option from "minimal" to "compact" (no schema
   * change needed — this `enum` is a Drizzle/TypeScript-level annotation
   * only, the column itself is plain SQLite TEXT). A pre-Phase-9 install
   * that already saved `'minimal'` is normalized back to `'compact'` on read
   * — see `toSettings()` in `SqliteBusinessRepository.ts` — instead of
   * requiring a migration.
   */
  defaultInvoiceTemplate: text('default_invoice_template', {
    enum: ['classic', 'modern', 'compact'],
  })
    .notNull()
    .default('classic'),
  /**
   * Entry point for the Phase 3 Invoice Type / Domain functionality — this
   * column just remembers the selection; the field-matrix behavior behind
   * "custom" is built in Phase 3.
   */
  invoiceType: text('invoice_type', {
    enum: ['general', 'quantity', 'weight', 'length', 'area', 'volume', 'time', 'service', 'custom'],
  })
    .notNull()
    .default('general'),
  /**
   * Phase 3 (Invoice Type / Domain) addition. Only meaningful when
   * `invoiceType` is `'custom'`: a JSON-encoded array of the field keys
   * (from `domain/invoiceType/fieldCatalog.ts`) the business owner chose,
   * in display order — e.g. `'["itemName","quantity","unitPrice","tax"]'`.
   * Null for the fixed types, whose field lists live in the invoice-type
   * registry instead of the database.
   */
  customInvoiceFields: text('custom_invoice_fields'),
  /**
   * JSON-encoded `CustomUnitsMap` (`domain/invoiceType/customUnits.ts`) —
   * business-added units for each of the four unit dropdowns (generic/
   * weight/length/time), layered on top of the fixed catalog in `units.ts`.
   * Null/malformed reads as "no custom units yet" (`parseCustomUnitsMap`).
   */
  customUnits: text('custom_units'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * One row per social/contact platform per business, instead of ad-hoc
 * `facebookUrl` / `instagramUrl` / ... columns on `business`.
 */
export const socialLink = sqliteTable(
  'social_link',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => business.id, { onDelete: 'cascade' }),
    platform: text('platform', {
      enum: ['whatsapp', 'facebook', 'instagram', 'googleMaps'],
    }).notNull(),
    value: text('value').notNull(),
  },
  (table) => ({
    businessPlatformUnique: uniqueIndex('social_link_business_platform_idx').on(
      table.businessId,
      table.platform,
    ),
  }),
);

/**
 * Item catalog (Phase 4). A **reusable definition** the business sells —
 * name, default price, tax, physical dimensions, and which invoice
 * type/domain it belongs to. This table intentionally has no invoice-linkage
 * column (no `invoiceId`, no "last invoiced" field): when an item is later
 * added to an invoice (Phase 6), `InvoiceItem` will copy a *snapshot* of
 * these columns onto the invoice line, independent of this row — see
 * `MVP_BUILD_PLAN.md` §6.2 and `domain/item/types.ts`.
 */
export const item = sqliteTable(
  'item',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    /** SKU / item code. Free text, not enforced unique — see IMPLEMENTATION_STATUS.md. */
    sku: text('sku'),
    /** Unit of sale, e.g. "pcs", "kg", "hr". Free text, not a fixed enum. */
    unit: text('unit'),
    defaultPrice: real('default_price').notNull().default(0),
    /** Percentage (0–100); null = no default tax for this item. */
    taxRate: real('tax_rate'),
    weight: real('weight'),
    /** Unit `weight` is in (kg/g/lb/oz) — added after this table's first release, see `ITEM_COLUMN_UPGRADES`. */
    weightUnit: text('weight_unit'),
    length: real('length'),
    width: real('width'),
    height: real('height'),
    /** Unit `length`/`width`/`height` are in (m/cm/mm/ft/in/yd) — added after this table's first release, see `ITEM_COLUMN_UPGRADES`. */
    lengthUnit: text('length_unit'),
    invoiceType: text('invoice_type', {
      enum: ['general', 'quantity', 'weight', 'length', 'area', 'volume', 'time', 'service', 'custom'],
    })
      .notNull()
      .default('general'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    // Common searches: by name (list search box) and by SKU (barcode/code
    // lookup); by invoice type (the List screen's type filter).
    nameIdx: index('item_name_idx').on(table.name),
    skuIdx: index('item_sku_idx').on(table.sku),
    invoiceTypeIdx: index('item_invoice_type_idx').on(table.invoiceType),
  }),
);

/**
 * Customer contact records (Phase 5). A **contact**, not a ledger — it has no
 * balance/outstanding/overdue column. Per `MVP_BUILD_PLAN.md` §6.3, a
 * customer's financial position is always calculated from `Invoice`/`Payment`
 * rows (once those exist — Phases 6/7), never cached here. See
 * `domain/customer/types.ts` and `data/customerActivity/`.
 */
export const customer = sqliteTable(
  'customer',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    /** Normalized `https://…` URL, or null. Added after this table's first release — see `CUSTOMER_COLUMN_UPGRADES`. */
    website: text('website'),
    address: text('address'),
    notes: text('notes'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    // Common searches: by name and phone (the list's search box and, later,
    // an incoming-call/contact lookup).
    nameIdx: index('customer_name_idx').on(table.name),
    phoneIdx: index('customer_phone_idx').on(table.phone),
  }),
);

/**
 * Invoices (Phase 6). `customerName` is a light snapshot of the customer's
 * name at creation time (see `domain/invoice/types.ts`); `invoiceType` is
 * fixed at creation (changing it after items are entered could orphan
 * already-typed per-line fields). `customerId` has no `onDelete` clause —
 * combined with `PRAGMA foreign_keys = ON` (see `db/client.ts`), deleting a
 * customer that has invoices fails with a constraint error rather than
 * silently orphaning historical invoices; the Customer List screen's
 * existing delete-with-confirmation flow already surfaces that as a generic
 * "couldn't delete" alert.
 */
export const invoice = sqliteTable(
  'invoice',
  {
    id: text('id').primaryKey(),
    /** Formatted once from the business's prefix + next number and never reassigned — see `BusinessRepository.reserveNextInvoiceNumber()`. */
    invoiceNumber: text('invoice_number').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customer.id),
    customerName: text('customer_name').notNull(),
    invoiceType: text('invoice_type', {
      enum: ['general', 'quantity', 'weight', 'length', 'area', 'volume', 'time', 'service', 'custom'],
    }).notNull(),
    /** ISO calendar date, `YYYY-MM-DD`. */
    issueDate: text('issue_date').notNull(),
    /** ISO calendar date, `YYYY-MM-DD`, or null = no due date set. */
    dueDate: text('due_date'),
    notes: text('notes'),
    terms: text('terms'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    // Unique, not just indexed: the DB-level backstop for "prevent accidental
    // duplicate invoice numbers" — `reserveNextInvoiceNumber()` is the normal
    // guard, this is the safety net if it's ever bypassed.
    invoiceNumberUnique: uniqueIndex('invoice_number_idx').on(table.invoiceNumber),
    customerIdx: index('invoice_customer_idx').on(table.customerId),
    issueDateIdx: index('invoice_issue_date_idx').on(table.issueDate),
  }),
);

/**
 * `InvoiceItem` rows are **frozen historical snapshots**, never a live join
 * onto `item` — see the "IMPORTANT SNAPSHOT RULE" in `MVP_BUILD_PLAN.md`
 * §6.2 and the doc comment on `InvoiceItemSnapshot` in
 * `domain/invoice/types.ts`. `itemId` uses `onDelete: 'set null'` so deleting
 * a catalog item (Phase 4's Item List screen) can never fail or corrupt an
 * existing invoice — the line's own copied fields are all that's needed to
 * redraw it. `subtotal`/`discountAmount`/`taxAmount`/`lineTotal` are computed
 * once via `domain/invoice/calculations.ts` at save time and stored, never
 * recomputed on read.
 */
export const invoiceItem = sqliteTable(
  'invoice_item',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoice.id, { onDelete: 'cascade' }),
    itemId: text('item_id').references(() => item.id, { onDelete: 'set null' }),
    /**
     * Snapshot of the parent invoice's `invoice_type` at the moment this line
     * was saved (added after the table's first release — see
     * `INVOICE_ITEM_COLUMN_UPGRADES` below). Nullable so pre-existing rows
     * from before this column existed read back as "inherits the parent
     * invoice's method" (`SqliteInvoiceRepository.toLineSnapshot`) instead of
     * failing a NOT NULL backfill; every row written from this point on
     * always has it set.
     */
    pricingMethod: text('pricing_method'),
    sortOrder: integer('sort_order').notNull().default(0),
    itemName: text('item_name').notNull(),
    description: text('description'),
    sku: text('sku'),
    quantity: real('quantity'),
    unit: text('unit'),
    weight: real('weight'),
    weightUnit: text('weight_unit'),
    length: real('length'),
    width: real('width'),
    height: real('height'),
    lengthUnit: text('length_unit'),
    timeUnit: text('time_unit'),
    unitPrice: real('unit_price').notNull(),
    discountPercent: real('discount_percent'),
    taxPercent: real('tax_percent'),
    subtotal: real('subtotal').notNull(),
    discountAmount: real('discount_amount').notNull(),
    taxAmount: real('tax_amount').notNull(),
    lineTotal: real('line_total').notNull(),
  },
  (table) => ({
    invoiceIdx: index('invoice_item_invoice_idx').on(table.invoiceId),
    itemIdx: index('invoice_item_item_idx').on(table.itemId),
  }),
);

/**
 * Payments (Phase 7). A **separate, additive record** against one invoice —
 * never a mutable `amountPaid` column on `invoice` — see the "IMPORTANT
 * PAYMENT RULE" in `MVP_BUILD_PLAN.md` §6.3 and the doc comment on `Payment`
 * in `domain/payment/types.ts`. `invoiceId` cascades: deleting an invoice
 * deletes its payment history with it (there's nothing left to have paid).
 * `customerId` mirrors `invoice.customerId` (no `onDelete` clause — a
 * customer with payments necessarily has invoices, which already block
 * deletion via their own FK). `invoiceNumber`/`customerName` are light,
 * additive snapshots, same reasoning as `invoice.customerName`.
 */
export const payment = sqliteTable(
  'payment',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoice.id, { onDelete: 'cascade' }),
    invoiceNumber: text('invoice_number').notNull(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customer.id),
    customerName: text('customer_name').notNull(),
    amount: real('amount').notNull(),
    /** ISO calendar date, `YYYY-MM-DD`. */
    paymentDate: text('payment_date').notNull(),
    method: text('method', {
      enum: ['cash', 'bank_transfer', 'card', 'paypal', 'other'],
    }).notNull(),
    reference: text('reference'),
    notes: text('notes'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    invoiceIdx: index('payment_invoice_idx').on(table.invoiceId),
    customerIdx: index('payment_customer_idx').on(table.customerId),
    dateIdx: index('payment_date_idx').on(table.paymentDate),
  }),
);

/**
 * App-level settings that aren't tied to the business profile (Phase 10 —
 * Settings). Singleton-per-device, same `id = 'default'` convention as
 * `business` (Phase 1). Kept as its own table rather than more columns on
 * `business` because these are device/app settings (e.g. whether *this*
 * installed app requires unlocking), not business data — `MVP_BUILD_PLAN.md`
 * §6.1 lists `AppSettings` as its own entity for exactly this reason.
 */
export const appSettings = sqliteTable('app_settings', {
  id: text('id').primaryKey(),
  /** Whether opening/resuming the app requires authenticating first. */
  appLockEnabled: integer('app_lock_enabled').notNull().default(0),
  /** Whether the App Lock screen offers biometric auth (Face ID/fingerprint) in addition to the device passcode — only meaningful on a device that actually supports it (see `BiometricService.isSupported()`). */
  biometricUnlockEnabled: integer('biometric_unlock_enabled').notNull().default(0),
  // --- Phase 11 (Google Drive Backup) additions ---
  /** Whether the app should opportunistically run a backup on its own (see `AutoBackupRunner`) — never a true OS background job, see IMPLEMENTATION_STATUS.md. */
  autoBackupEnabled: integer('auto_backup_enabled').notNull().default(0),
  /** Epoch ms of the most recent *successful* backup, across manual and automatic triggers. Null until the first one succeeds. */
  lastBackupAt: integer('last_backup_at'),
  /** Outcome of the most recent backup *attempt* (success or failure), regardless of whether it updated `lastBackupAt`. Null until a backup has ever been attempted. */
  lastBackupStatus: text('last_backup_status', { enum: ['success', 'failure'] }),
  /** Human-readable reason for the most recent failed attempt; null when the last attempt succeeded or none has run yet. */
  lastBackupError: text('last_backup_error'),
  // --- Phase 12 (Optional Cloud Backup) additions ---
  /** Whether cloud backup is turned on for this device — the cloud-backup equivalent of `autoBackupEnabled`, but also gates manual cloud backups/restores (see `CloudBackupService`). */
  cloudBackupEnabled: integer('cloud_backup_enabled').notNull().default(0),
  /** The storage plan (`domain/cloudBackup/types.ts`'s `CloudStoragePlanId`) this device was last known to be on — null until the first successful `CloudBackupService.getStorageUsage()` call. */
  cloudBackupPlanId: text('cloud_backup_plan_id'),
  /** Epoch ms of the most recent *successful* cloud backup. Null until the first one succeeds. */
  lastCloudBackupAt: integer('last_cloud_backup_at'),
  /** Outcome of the most recent cloud backup *attempt*, regardless of whether it updated `lastCloudBackupAt`. */
  lastCloudBackupStatus: text('last_cloud_backup_status', { enum: ['success', 'failure'] }),
  /** Human-readable reason for the most recent failed cloud backup attempt. */
  lastCloudBackupError: text('last_cloud_backup_error'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Backup/restore history (Phase 11). One row per attempt — manual or
 * automatic, backup or restore — kept even on failure so the Backup History
 * screen can show *why* something didn't work, not just the successes. Never
 * mutated after `finishedAt` is set; a new attempt is always a new row.
 */
export const backupLog = sqliteTable(
  'backup_log',
  {
    id: text('id').primaryKey(),
    direction: text('direction', { enum: ['backup', 'restore'] }).notNull(),
    trigger: text('trigger', { enum: ['manual', 'automatic'] }).notNull(),
    status: text('status', { enum: ['success', 'failure'] }).notNull(),
    /** Where the backup content came from/went to: `'google_drive'` (Phase 11) or `'cloud'` (Phase 12) — kept as text (not a Drizzle-level enum) from the start specifically so this second destination was additive, not a migration. */
    destination: text('destination').notNull().default('google_drive'),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    /** The backup format version involved (see `domain/backup/types.ts`); null if the attempt failed before a payload could be built/read. */
    formatVersion: integer('format_version'),
    sizeBytes: integer('size_bytes'),
    /** JSON-encoded `BackupCounts` (row counts per table) — a quick "what was in this backup" summary without re-parsing the full payload. */
    itemCounts: text('item_counts'),
    errorMessage: text('error_message'),
  },
  (table) => ({
    startedAtIdx: index('backup_log_started_at_idx').on(table.startedAt),
  }),
);

export const schema = {
  business,
  socialLink,
  item,
  customer,
  invoice,
  invoiceItem,
  payment,
  appSettings,
  backupLog,
};

/**
 * Raw bootstrap SQL kept in lockstep with the schema above — see db/client.ts.
 * Executed directly through the expo-sqlite connection (idempotent, safe to
 * run on every app start) rather than through a generated migration runner —
 * see the note in db/client.ts for why.
 */
export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS business (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    owner_name TEXT,
    logo_uri TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    tax_id TEXT,
    share_slug TEXT NOT NULL,
    business_code TEXT,
    invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
    next_invoice_number INTEGER NOT NULL DEFAULT 1,
    default_tax_rate REAL,
    default_payment_terms_days INTEGER,
    default_invoice_template TEXT NOT NULL DEFAULT 'classic',
    invoice_type TEXT NOT NULL DEFAULT 'general',
    custom_invoice_fields TEXT,
    custom_units TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS social_link (
    id TEXT PRIMARY KEY NOT NULL,
    business_id TEXT NOT NULL REFERENCES business(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    value TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS social_link_business_platform_idx
    ON social_link (business_id, platform);
  CREATE TABLE IF NOT EXISTS item (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    unit TEXT,
    default_price REAL NOT NULL DEFAULT 0,
    tax_rate REAL,
    weight REAL,
    weight_unit TEXT,
    length REAL,
    width REAL,
    height REAL,
    length_unit TEXT,
    invoice_type TEXT NOT NULL DEFAULT 'general',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS item_name_idx ON item (name);
  CREATE INDEX IF NOT EXISTS item_sku_idx ON item (sku);
  CREATE INDEX IF NOT EXISTS item_invoice_type_idx ON item (invoice_type);
  CREATE TABLE IF NOT EXISTS customer (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS customer_name_idx ON customer (name);
  CREATE INDEX IF NOT EXISTS customer_phone_idx ON customer (phone);
  CREATE TABLE IF NOT EXISTS invoice (
    id TEXT PRIMARY KEY NOT NULL,
    invoice_number TEXT NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customer(id),
    customer_name TEXT NOT NULL,
    invoice_type TEXT NOT NULL,
    issue_date TEXT NOT NULL,
    due_date TEXT,
    notes TEXT,
    terms TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS invoice_number_idx ON invoice (invoice_number);
  CREATE INDEX IF NOT EXISTS invoice_customer_idx ON invoice (customer_id);
  CREATE INDEX IF NOT EXISTS invoice_issue_date_idx ON invoice (issue_date);
  CREATE TABLE IF NOT EXISTS invoice_item (
    id TEXT PRIMARY KEY NOT NULL,
    invoice_id TEXT NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES item(id) ON DELETE SET NULL,
    pricing_method TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    item_name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    quantity REAL,
    unit TEXT,
    weight REAL,
    weight_unit TEXT,
    length REAL,
    width REAL,
    height REAL,
    length_unit TEXT,
    time_unit TEXT,
    unit_price REAL NOT NULL,
    discount_percent REAL,
    tax_percent REAL,
    subtotal REAL NOT NULL,
    discount_amount REAL NOT NULL,
    tax_amount REAL NOT NULL,
    line_total REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS invoice_item_invoice_idx ON invoice_item (invoice_id);
  CREATE INDEX IF NOT EXISTS invoice_item_item_idx ON invoice_item (item_id);
  CREATE TABLE IF NOT EXISTS payment (
    id TEXT PRIMARY KEY NOT NULL,
    invoice_id TEXT NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customer(id),
    customer_name TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_date TEXT NOT NULL,
    method TEXT NOT NULL,
    reference TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS payment_invoice_idx ON payment (invoice_id);
  CREATE INDEX IF NOT EXISTS payment_customer_idx ON payment (customer_id);
  CREATE INDEX IF NOT EXISTS payment_date_idx ON payment (payment_date);
  CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY NOT NULL,
    app_lock_enabled INTEGER NOT NULL DEFAULT 0,
    biometric_unlock_enabled INTEGER NOT NULL DEFAULT 0,
    auto_backup_enabled INTEGER NOT NULL DEFAULT 0,
    last_backup_at INTEGER,
    last_backup_status TEXT,
    last_backup_error TEXT,
    cloud_backup_enabled INTEGER NOT NULL DEFAULT 0,
    cloud_backup_plan_id TEXT,
    last_cloud_backup_at INTEGER,
    last_cloud_backup_status TEXT,
    last_cloud_backup_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS backup_log (
    id TEXT PRIMARY KEY NOT NULL,
    direction TEXT NOT NULL,
    trigger TEXT NOT NULL,
    status TEXT NOT NULL,
    destination TEXT NOT NULL DEFAULT 'google_drive',
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    format_version INTEGER,
    size_bytes INTEGER,
    item_counts TEXT,
    error_message TEXT
  );
  CREATE INDEX IF NOT EXISTS backup_log_started_at_idx ON backup_log (started_at);
`;

/**
 * Columns added to `business` after its first release (Phase 2). Fresh
 * installs get them from `CREATE_TABLES_SQL` above; installs that already
 * have a `business` table from before Phase 2 get them backfilled here via
 * `ALTER TABLE ... ADD COLUMN`, one at a time, only for columns that don't
 * already exist (checked via `PRAGMA table_info`) — see `db/client.ts`.
 * Keep this in lockstep with the schema above.
 */
export const BUSINESS_COLUMN_UPGRADES: { column: string; definition: string }[] = [
  { column: 'business_code', definition: 'TEXT' },
  { column: 'invoice_prefix', definition: "TEXT NOT NULL DEFAULT 'INV-'" },
  { column: 'next_invoice_number', definition: 'INTEGER NOT NULL DEFAULT 1' },
  { column: 'default_tax_rate', definition: 'REAL' },
  { column: 'default_payment_terms_days', definition: 'INTEGER' },
  { column: 'default_invoice_template', definition: "TEXT NOT NULL DEFAULT 'classic'" },
  { column: 'invoice_type', definition: "TEXT NOT NULL DEFAULT 'general'" },
  { column: 'custom_invoice_fields', definition: 'TEXT' },
  { column: 'custom_units', definition: 'TEXT' },
];

/**
 * Columns added to `app_settings` after its first release (Phase 10, which
 * only had the two App Lock columns; Phase 11 added the four Google Drive
 * backup-status columns; Phase 12 adds the five cloud-backup ones below).
 * Same additive/idempotent `ALTER TABLE ... ADD COLUMN` mechanism as
 * `BUSINESS_COLUMN_UPGRADES` above — see `ensureAppSettingsColumns()` in
 * `db/client.ts`.
 */
/**
 * Columns added to `item` after its first release (this refactor's
 * weight/length unit-selector columns). Same additive/idempotent mechanism
 * as `BUSINESS_COLUMN_UPGRADES` — see `ensureItemColumns()` in `db/client.ts`.
 */
export const ITEM_COLUMN_UPGRADES: { column: string; definition: string }[] = [
  { column: 'weight_unit', definition: 'TEXT' },
  { column: 'length_unit', definition: 'TEXT' },
];

/**
 * Columns added to `invoice_item` after its first release (this refactor's
 * pricing-method-integrity column). Same additive/idempotent mechanism as
 * `BUSINESS_COLUMN_UPGRADES` — see `ensureInvoiceItemColumns()` in
 * `db/client.ts`.
 */
export const INVOICE_ITEM_COLUMN_UPGRADES: { column: string; definition: string }[] = [
  { column: 'pricing_method', definition: 'TEXT' },
  { column: 'weight_unit', definition: 'TEXT' },
  { column: 'length_unit', definition: 'TEXT' },
  { column: 'time_unit', definition: 'TEXT' },
];

/**
 * Columns added to `customer` after its first release (this refactor's
 * `website` field, powering the Call/Email/Website/Directions actions on
 * Customer/Invoice Detail). Same additive/idempotent mechanism as
 * `BUSINESS_COLUMN_UPGRADES` — see `ensureCustomerColumns()` in `db/client.ts`.
 */
export const CUSTOMER_COLUMN_UPGRADES: { column: string; definition: string }[] = [
  { column: 'website', definition: 'TEXT' },
];

export const APP_SETTINGS_COLUMN_UPGRADES: { column: string; definition: string }[] = [
  { column: 'auto_backup_enabled', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { column: 'last_backup_at', definition: 'INTEGER' },
  { column: 'last_backup_status', definition: 'TEXT' },
  { column: 'last_backup_error', definition: 'TEXT' },
  { column: 'cloud_backup_enabled', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { column: 'cloud_backup_plan_id', definition: 'TEXT' },
  { column: 'last_cloud_backup_at', definition: 'INTEGER' },
  { column: 'last_cloud_backup_status', definition: 'TEXT' },
  { column: 'last_cloud_backup_error', definition: 'TEXT' },
];
