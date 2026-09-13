import { eq } from 'drizzle-orm';

import {
  formatNextInvoiceNumber,
  type BusinessProfile,
  type BusinessProfileInput,
  type InvoiceSettings,
  type InvoiceSettingsInput,
  type InvoiceTemplate,
  type InvoiceType,
} from '@/domain/business/types';
import {
  normalizeCustomFieldKeys,
  type FieldKey,
  type InvoiceTypeSelection,
  type InvoiceTypeSelectionInput,
} from '@/domain/invoiceType/types';
import { isFieldKey } from '@/domain/invoiceType/fieldCatalog';
import { normalizeLegacyInvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import {
  addCustomUnitToList,
  baseUnitOptionsFor,
  parseCustomUnitsMap,
  type CustomUnitsMap,
  type UnitFieldKind,
} from '@/domain/invoiceType/customUnits';
import { generateBusinessCode, generateLocalId } from '@/lib/id';

import { getDatabase, getDrizzle } from '../db/client';
import { business } from '../db/schema';
import type { BusinessRepository } from './BusinessRepository';

/** Same single on-device business row `SqliteBusinessCardRepository` uses. */
const BUSINESS_ID = 'default';

/**
 * `row.businessCode` must already be resolved (non-null) by the caller —
 * either a freshly-generated code for a brand-new row, the existing row's
 * stored code, or a lazily-backfilled one via `ensureBusinessCode()` below —
 * never generated inside this pure mapping function.
 */
function toProfile(row: typeof business.$inferSelect): BusinessProfile {
  return {
    id: row.id,
    businessName: row.name,
    logoUri: row.logoUri,
    address: row.address,
    phone: row.phone,
    email: row.email,
    website: row.website,
    currency: row.currency,
    taxId: row.taxId,
    businessCode: row.businessCode ?? '',
    invoicePrefix: row.invoicePrefix,
    nextInvoiceNumber: row.nextInvoiceNumber,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** Pre-Phase-9 installs may have persisted the old `'minimal'` template id — normalize it to `'compact'` rather than requiring a migration. */
function toInvoiceTemplate(raw: string): InvoiceTemplate {
  return raw === 'minimal' ? 'compact' : (raw as InvoiceTemplate);
}

/** Same "caller must resolve `businessCode` first" rule as `toProfile()` above. */
function toSettings(row: typeof business.$inferSelect): InvoiceSettings {
  return {
    businessCode: row.businessCode ?? '',
    invoicePrefix: row.invoicePrefix,
    nextInvoiceNumber: row.nextInvoiceNumber,
    currency: row.currency,
    defaultTaxRate: row.defaultTaxRate,
    defaultPaymentTermsDays: row.defaultPaymentTermsDays,
    defaultInvoiceTemplate: toInvoiceTemplate(row.defaultInvoiceTemplate),
    invoiceType: normalizeLegacyInvoiceTypeId(row.invoiceType) as InvoiceType,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** Parses the `custom_invoice_fields` JSON column, tolerating null/malformed/legacy values. */
function parseCustomFieldKeys(raw: string | null): FieldKey[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is FieldKey => typeof value === 'string' && isFieldKey(value));
  } catch {
    return [];
  }
}

function toSelection(row: typeof business.$inferSelect): InvoiceTypeSelection {
  return {
    invoiceTypeId: normalizeLegacyInvoiceTypeId(row.invoiceType),
    customFieldKeys: parseCustomFieldKeys(row.customInvoiceFields),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function toCustomUnits(row: { customUnits: string | null } | undefined): CustomUnitsMap {
  return parseCustomUnitsMap(row?.customUnits ?? null);
}

/**
 * Reads/writes the same `business` row `SqliteBusinessCardRepository`
 * (Phase 1) uses. Every write here goes through Drizzle's `.set(values)` /
 * `.insert(values)` with only the columns this feature owns, so saving a
 * business profile never touches invoice-settings-only columns (and vice
 * versa) or the Digital Business Card's social links / owner name — no data
 * loss across the three feature slices sharing this one row.
 */
export class SqliteBusinessRepository implements BusinessRepository {
  /**
   * Returns `row.businessCode` as-is if it's already set, otherwise
   * generates one and persists it immediately — a lazy backfill for a row
   * that predates the `business_code` column (added via
   * `BUSINESS_COLUMN_UPGRADES`), so every read/write from this point on
   * always has a real code to work with.
   */
  private async ensureBusinessCode(row: { id: string; businessCode: string | null }): Promise<string> {
    if (row.businessCode) {
      return row.businessCode;
    }
    const db = getDrizzle();
    const code = generateBusinessCode();
    await db.update(business).set({ businessCode: code }).where(eq(business.id, row.id));
    return code;
  }

  async getProfile(): Promise<BusinessProfile | null> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(business).where(eq(business.id, BUSINESS_ID));
    const row = rows[0];
    if (!row) {
      return null;
    }
    const businessCode = await this.ensureBusinessCode(row);
    return toProfile({ ...row, businessCode });
  }

  async saveProfile(input: BusinessProfileInput): Promise<BusinessProfile> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const existing = await db
      .select({
        id: business.id,
        createdAt: business.createdAt,
        shareSlug: business.shareSlug,
        businessCode: business.businessCode,
      })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));

    const shareSlug = existing[0]?.shareSlug ?? generateLocalId();
    const createdAt = existing[0]?.createdAt ?? now;
    const businessCode = existing[0]?.businessCode ?? generateBusinessCode();

    const values = {
      id: BUSINESS_ID,
      name: input.businessName,
      logoUri: input.logoUri,
      address: input.address,
      phone: input.phone,
      email: input.email,
      website: input.website,
      currency: input.currency,
      taxId: input.taxId,
      businessCode,
      invoicePrefix: input.invoicePrefix,
      nextInvoiceNumber: input.nextInvoiceNumber,
      shareSlug,
      createdAt,
      updatedAt: now,
    };

    if (existing[0]) {
      await db.update(business).set(values).where(eq(business.id, BUSINESS_ID));
    } else {
      await db.insert(business).values(values);
    }

    const saved = await this.getProfile();
    if (!saved) {
      throw new Error('Failed to read back the business profile after saving.');
    }
    return saved;
  }

  async getInvoiceSettings(): Promise<InvoiceSettings | null> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(business).where(eq(business.id, BUSINESS_ID));
    const row = rows[0];
    if (!row) {
      return null;
    }
    const businessCode = await this.ensureBusinessCode(row);
    return toSettings({ ...row, businessCode });
  }

  async saveInvoiceSettings(input: InvoiceSettingsInput): Promise<InvoiceSettings> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const existing = await db
      .select({
        id: business.id,
        name: business.name,
        createdAt: business.createdAt,
        shareSlug: business.shareSlug,
        businessCode: business.businessCode,
      })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));

    const shareSlug = existing[0]?.shareSlug ?? generateLocalId();
    const createdAt = existing[0]?.createdAt ?? now;
    const name = existing[0]?.name ?? '';
    const businessCode = existing[0]?.businessCode ?? generateBusinessCode();

    const values = {
      id: BUSINESS_ID,
      name,
      businessCode,
      invoicePrefix: input.invoicePrefix,
      nextInvoiceNumber: input.nextInvoiceNumber,
      currency: input.currency,
      defaultTaxRate: input.defaultTaxRate,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays,
      defaultInvoiceTemplate: input.defaultInvoiceTemplate,
      invoiceType: input.invoiceType,
      shareSlug,
      createdAt,
      updatedAt: now,
    };

    if (existing[0]) {
      await db.update(business).set(values).where(eq(business.id, BUSINESS_ID));
    } else {
      await db.insert(business).values(values);
    }

    const saved = await this.getInvoiceSettings();
    if (!saved) {
      throw new Error('Failed to read back the invoice settings after saving.');
    }
    return saved;
  }

  async getInvoiceTypeSelection(): Promise<InvoiceTypeSelection | null> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(business).where(eq(business.id, BUSINESS_ID));
    const row = rows[0];
    return row ? toSelection(row) : null;
  }

  async saveInvoiceTypeSelection(input: InvoiceTypeSelectionInput): Promise<InvoiceTypeSelection> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const existing = await db
      .select({
        id: business.id,
        name: business.name,
        createdAt: business.createdAt,
        shareSlug: business.shareSlug,
        businessCode: business.businessCode,
      })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));

    const shareSlug = existing[0]?.shareSlug ?? generateLocalId();
    const createdAt = existing[0]?.createdAt ?? now;
    const name = existing[0]?.name ?? '';
    const businessCode = existing[0]?.businessCode ?? generateBusinessCode();

    const values = {
      id: BUSINESS_ID,
      name,
      businessCode,
      invoiceType: input.invoiceTypeId,
      customInvoiceFields:
        input.invoiceTypeId === 'custom'
          ? JSON.stringify(normalizeCustomFieldKeys(input.customFieldKeys))
          : null,
      shareSlug,
      createdAt,
      updatedAt: now,
    };

    if (existing[0]) {
      await db.update(business).set(values).where(eq(business.id, BUSINESS_ID));
    } else {
      await db.insert(business).values(values);
    }

    const saved = await this.getInvoiceTypeSelection();
    if (!saved) {
      throw new Error('Failed to read back the invoice type selection after saving.');
    }
    return saved;
  }

  async getCustomUnits(): Promise<CustomUnitsMap> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db
      .select({ customUnits: business.customUnits })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));
    return toCustomUnits(rows[0]);
  }

  async addCustomUnit(kind: UnitFieldKind, label: string): Promise<CustomUnitsMap> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const existing = await db
      .select({
        id: business.id,
        name: business.name,
        createdAt: business.createdAt,
        shareSlug: business.shareSlug,
        businessCode: business.businessCode,
        customUnits: business.customUnits,
      })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));

    const shareSlug = existing[0]?.shareSlug ?? generateLocalId();
    const createdAt = existing[0]?.createdAt ?? now;
    const name = existing[0]?.name ?? '';
    const businessCode = existing[0]?.businessCode ?? generateBusinessCode();

    const current = toCustomUnits(existing[0]);
    const updated: CustomUnitsMap = {
      ...current,
      [kind]: addCustomUnitToList(current[kind], label, baseUnitOptionsFor(kind)),
    };

    const values = {
      id: BUSINESS_ID,
      name,
      businessCode,
      customUnits: JSON.stringify(updated),
      shareSlug,
      createdAt,
      updatedAt: now,
    };

    if (existing[0]) {
      await db.update(business).set(values).where(eq(business.id, BUSINESS_ID));
    } else {
      await db.insert(business).values(values);
    }

    return updated;
  }

  async reserveNextInvoiceNumber(): Promise<string> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const existing = await db
      .select({
        id: business.id,
        name: business.name,
        createdAt: business.createdAt,
        shareSlug: business.shareSlug,
        businessCode: business.businessCode,
        invoicePrefix: business.invoicePrefix,
        nextInvoiceNumber: business.nextInvoiceNumber,
      })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));

    const row = existing[0];
    const businessCode = row?.businessCode ?? generateBusinessCode();
    const invoicePrefix = row?.invoicePrefix ?? 'INV-';
    const nextInvoiceNumber = row?.nextInvoiceNumber ?? 1;
    const invoiceNumber = formatNextInvoiceNumber(invoicePrefix, businessCode, nextInvoiceNumber);

    const values = {
      id: BUSINESS_ID,
      name: row?.name ?? '',
      businessCode,
      invoicePrefix,
      nextInvoiceNumber: nextInvoiceNumber + 1,
      shareSlug: row?.shareSlug ?? generateLocalId(),
      createdAt: row?.createdAt ?? now,
      updatedAt: now,
    };

    if (row) {
      await db.update(business).set(values).where(eq(business.id, BUSINESS_ID));
    } else {
      await db.insert(business).values(values);
    }

    return invoiceNumber;
  }
}
