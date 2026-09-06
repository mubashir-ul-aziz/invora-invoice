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
  // --- Phase 2 (Business / Company + Invoice Settings) additions ---
  invoicePrefix: text('invoice_prefix').notNull().default('INV-'),
  nextInvoiceNumber: integer('next_invoice_number').notNull().default(1),
  /** Percentage (0–100), null = no default tax applied to new invoices. */
  defaultTaxRate: real('default_tax_rate'),
  /** Days until due; 0 = due on receipt; null = no default. */
  defaultPaymentTermsDays: integer('default_payment_terms_days'),
  defaultInvoiceTemplate: text('default_invoice_template', {
    enum: ['classic', 'modern', 'minimal'],
  })
    .notNull()
    .default('classic'),
  /**
   * Entry point for the Phase 3 Invoice Type / Domain functionality — this
   * column just remembers the selection; the field-matrix behavior behind
   * "custom" is built in Phase 3.
   */
  invoiceType: text('invoice_type', {
    enum: ['general', 'quantity', 'weight', 'dimension', 'custom'],
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
    length: real('length'),
    width: real('width'),
    height: real('height'),
    invoiceType: text('invoice_type', {
      enum: ['general', 'quantity', 'weight', 'dimension', 'custom'],
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
      enum: ['general', 'quantity', 'weight', 'dimension', 'custom'],
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
    sortOrder: integer('sort_order').notNull().default(0),
    itemName: text('item_name').notNull(),
    description: text('description'),
    sku: text('sku'),
    quantity: real('quantity'),
    unit: text('unit'),
    weight: real('weight'),
    length: real('length'),
    width: real('width'),
    height: real('height'),
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

export const schema = { business, socialLink, item, customer, invoice, invoiceItem };

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
    invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
    next_invoice_number INTEGER NOT NULL DEFAULT 1,
    default_tax_rate REAL,
    default_payment_terms_days INTEGER,
    default_invoice_template TEXT NOT NULL DEFAULT 'classic',
    invoice_type TEXT NOT NULL DEFAULT 'general',
    custom_invoice_fields TEXT,
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
    length REAL,
    width REAL,
    height REAL,
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
    sort_order INTEGER NOT NULL DEFAULT 0,
    item_name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    quantity REAL,
    unit TEXT,
    weight REAL,
    length REAL,
    width REAL,
    height REAL,
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
  { column: 'invoice_prefix', definition: "TEXT NOT NULL DEFAULT 'INV-'" },
  { column: 'next_invoice_number', definition: 'INTEGER NOT NULL DEFAULT 1' },
  { column: 'default_tax_rate', definition: 'REAL' },
  { column: 'default_payment_terms_days', definition: 'INTEGER' },
  { column: 'default_invoice_template', definition: "TEXT NOT NULL DEFAULT 'classic'" },
  { column: 'invoice_type', definition: "TEXT NOT NULL DEFAULT 'general'" },
  { column: 'custom_invoice_fields', definition: 'TEXT' },
];
