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
import { generateLocalId } from '@/lib/id';

import { getDatabase, getDrizzle } from '../db/client';
import { business } from '../db/schema';
import type { BusinessRepository } from './BusinessRepository';

/** Same single on-device business row `SqliteBusinessCardRepository` uses. */
const BUSINESS_ID = 'default';

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
    invoicePrefix: row.invoicePrefix,
    nextInvoiceNumber: row.nextInvoiceNumber,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** Pre-Phase-9 installs may have persisted the old `'minimal'` template id — normalize it to `'compact'` rather than requiring a migration. */
function toInvoiceTemplate(raw: string): InvoiceTemplate {
  return raw === 'minimal' ? 'compact' : (raw as InvoiceTemplate);
}

function toSettings(row: typeof business.$inferSelect): InvoiceSettings {
  return {
    invoicePrefix: row.invoicePrefix,
    nextInvoiceNumber: row.nextInvoiceNumber,
    currency: row.currency,
    defaultTaxRate: row.defaultTaxRate,
    defaultPaymentTermsDays: row.defaultPaymentTermsDays,
    defaultInvoiceTemplate: toInvoiceTemplate(row.defaultInvoiceTemplate),
    invoiceType: row.invoiceType as InvoiceType,
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
    invoiceTypeId: row.invoiceType as InvoiceType,
    customFieldKeys: parseCustomFieldKeys(row.customInvoiceFields),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
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
  async getProfile(): Promise<BusinessProfile | null> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(business).where(eq(business.id, BUSINESS_ID));
    const row = rows[0];
    return row ? toProfile(row) : null;
  }

  async saveProfile(input: BusinessProfileInput): Promise<BusinessProfile> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const existing = await db
      .select({ id: business.id, createdAt: business.createdAt, shareSlug: business.shareSlug })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));

    const shareSlug = existing[0]?.shareSlug ?? generateLocalId();
    const createdAt = existing[0]?.createdAt ?? now;

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
    return row ? toSettings(row) : null;
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
      })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));

    const shareSlug = existing[0]?.shareSlug ?? generateLocalId();
    const createdAt = existing[0]?.createdAt ?? now;
    const name = existing[0]?.name ?? '';

    const values = {
      id: BUSINESS_ID,
      name,
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
      })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));

    const shareSlug = existing[0]?.shareSlug ?? generateLocalId();
    const createdAt = existing[0]?.createdAt ?? now;
    const name = existing[0]?.name ?? '';

    const values = {
      id: BUSINESS_ID,
      name,
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
        invoicePrefix: business.invoicePrefix,
        nextInvoiceNumber: business.nextInvoiceNumber,
      })
      .from(business)
      .where(eq(business.id, BUSINESS_ID));

    const row = existing[0];
    const invoicePrefix = row?.invoicePrefix ?? 'INV-';
    const nextInvoiceNumber = row?.nextInvoiceNumber ?? 1;
    const invoiceNumber = formatNextInvoiceNumber(invoicePrefix, nextInvoiceNumber);

    const values = {
      id: BUSINESS_ID,
      name: row?.name ?? '',
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
