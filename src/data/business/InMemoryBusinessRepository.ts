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
import {
  addCustomUnitToList,
  baseUnitOptionsFor,
  EMPTY_CUSTOM_UNITS,
  type CustomUnitsMap,
  type UnitFieldKind,
} from '@/domain/invoiceType/customUnits';
import { generateBusinessCode, generateLocalId } from '@/lib/id';

import type { BusinessRepository } from './BusinessRepository';

/** Mirrors the shape of the single shared `business` row (see `db/schema.ts`). */
interface Row {
  id: string;
  businessName: string;
  logoUri: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  currency: string;
  taxId: string | null;
  /** Generated once (`generateBusinessCode()`) when the row is first created; carried through unchanged on every later save. */
  businessCode: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  defaultTaxRate: number | null;
  defaultPaymentTermsDays: number | null;
  defaultInvoiceTemplate: InvoiceTemplate;
  invoiceType: InvoiceType;
  /** Only meaningful when `invoiceType` is `'custom'` — see `db/schema.ts`. */
  customFieldKeys: FieldKey[];
  /** Business-added units per unit dropdown kind — see `db/schema.ts`'s `custom_units` column. */
  customUnits: CustomUnitsMap;
  updatedAt: string;
}

function toProfile(row: Row): BusinessProfile {
  return {
    id: row.id,
    businessName: row.businessName,
    logoUri: row.logoUri,
    address: row.address,
    phone: row.phone,
    email: row.email,
    website: row.website,
    currency: row.currency,
    taxId: row.taxId,
    businessCode: row.businessCode,
    invoicePrefix: row.invoicePrefix,
    nextInvoiceNumber: row.nextInvoiceNumber,
    updatedAt: row.updatedAt,
  };
}

function toSettings(row: Row): InvoiceSettings {
  return {
    businessCode: row.businessCode,
    invoicePrefix: row.invoicePrefix,
    nextInvoiceNumber: row.nextInvoiceNumber,
    currency: row.currency,
    defaultTaxRate: row.defaultTaxRate,
    defaultPaymentTermsDays: row.defaultPaymentTermsDays,
    defaultInvoiceTemplate: row.defaultInvoiceTemplate,
    invoiceType: row.invoiceType,
    updatedAt: row.updatedAt,
  };
}

function toSelection(row: Row): InvoiceTypeSelection {
  return {
    invoiceTypeId: row.invoiceType,
    customFieldKeys: row.customFieldKeys,
    updatedAt: row.updatedAt,
  };
}

/**
 * Frontend-first mock repository — no database, no I/O. Used to build and
 * unit-test the UI/state layer before the SQLite-backed repository exists,
 * and kept afterwards for fast Jest tests (same role as
 * `InMemoryBusinessCardRepository` in Phase 1).
 */
export class InMemoryBusinessRepository implements BusinessRepository {
  private row: Row | null;

  constructor(seed: Row | null = null) {
    this.row = seed;
  }

  async getProfile(): Promise<BusinessProfile | null> {
    return this.row ? toProfile(this.row) : null;
  }

  async saveProfile(input: BusinessProfileInput): Promise<BusinessProfile> {
    const now = new Date().toISOString();
    this.row = {
      id: this.row?.id ?? generateLocalId('biz_'),
      businessCode: this.row?.businessCode ?? generateBusinessCode(),
      defaultTaxRate: this.row?.defaultTaxRate ?? null,
      defaultPaymentTermsDays: this.row?.defaultPaymentTermsDays ?? null,
      defaultInvoiceTemplate: this.row?.defaultInvoiceTemplate ?? 'classic',
      invoiceType: this.row?.invoiceType ?? 'general',
      customFieldKeys: this.row?.customFieldKeys ?? [],
      customUnits: this.row?.customUnits ?? { ...EMPTY_CUSTOM_UNITS },
      ...input,
      updatedAt: now,
    };
    return toProfile(this.row);
  }

  async getInvoiceSettings(): Promise<InvoiceSettings | null> {
    return this.row ? toSettings(this.row) : null;
  }

  async saveInvoiceSettings(input: InvoiceSettingsInput): Promise<InvoiceSettings> {
    const now = new Date().toISOString();
    this.row = {
      id: this.row?.id ?? generateLocalId('biz_'),
      businessCode: this.row?.businessCode ?? generateBusinessCode(),
      businessName: this.row?.businessName ?? '',
      logoUri: this.row?.logoUri ?? null,
      address: this.row?.address ?? null,
      phone: this.row?.phone ?? null,
      email: this.row?.email ?? null,
      website: this.row?.website ?? null,
      taxId: this.row?.taxId ?? null,
      customFieldKeys: this.row?.customFieldKeys ?? [],
      customUnits: this.row?.customUnits ?? { ...EMPTY_CUSTOM_UNITS },
      ...input,
      updatedAt: now,
    };
    return toSettings(this.row);
  }

  async getInvoiceTypeSelection(): Promise<InvoiceTypeSelection | null> {
    return this.row ? toSelection(this.row) : null;
  }

  async saveInvoiceTypeSelection(input: InvoiceTypeSelectionInput): Promise<InvoiceTypeSelection> {
    const now = new Date().toISOString();
    this.row = {
      id: this.row?.id ?? generateLocalId('biz_'),
      businessCode: this.row?.businessCode ?? generateBusinessCode(),
      businessName: this.row?.businessName ?? '',
      logoUri: this.row?.logoUri ?? null,
      address: this.row?.address ?? null,
      phone: this.row?.phone ?? null,
      email: this.row?.email ?? null,
      website: this.row?.website ?? null,
      taxId: this.row?.taxId ?? null,
      currency: this.row?.currency ?? 'USD',
      invoicePrefix: this.row?.invoicePrefix ?? 'INV-',
      nextInvoiceNumber: this.row?.nextInvoiceNumber ?? 1,
      defaultTaxRate: this.row?.defaultTaxRate ?? null,
      defaultPaymentTermsDays: this.row?.defaultPaymentTermsDays ?? null,
      defaultInvoiceTemplate: this.row?.defaultInvoiceTemplate ?? 'classic',
      invoiceType: input.invoiceTypeId,
      customFieldKeys:
        input.invoiceTypeId === 'custom' ? normalizeCustomFieldKeys(input.customFieldKeys) : [],
      customUnits: this.row?.customUnits ?? { ...EMPTY_CUSTOM_UNITS },
      updatedAt: now,
    };
    return toSelection(this.row);
  }

  async getCustomUnits(): Promise<CustomUnitsMap> {
    return this.row?.customUnits ?? { ...EMPTY_CUSTOM_UNITS };
  }

  async addCustomUnit(kind: UnitFieldKind, label: string): Promise<CustomUnitsMap> {
    const now = new Date().toISOString();
    const current = this.row?.customUnits ?? { ...EMPTY_CUSTOM_UNITS };
    const updated: CustomUnitsMap = {
      ...current,
      [kind]: addCustomUnitToList(current[kind], label, baseUnitOptionsFor(kind)),
    };
    this.row = {
      id: this.row?.id ?? generateLocalId('biz_'),
      businessCode: this.row?.businessCode ?? generateBusinessCode(),
      businessName: this.row?.businessName ?? '',
      logoUri: this.row?.logoUri ?? null,
      address: this.row?.address ?? null,
      phone: this.row?.phone ?? null,
      email: this.row?.email ?? null,
      website: this.row?.website ?? null,
      taxId: this.row?.taxId ?? null,
      currency: this.row?.currency ?? 'USD',
      invoicePrefix: this.row?.invoicePrefix ?? 'INV-',
      nextInvoiceNumber: this.row?.nextInvoiceNumber ?? 1,
      defaultTaxRate: this.row?.defaultTaxRate ?? null,
      defaultPaymentTermsDays: this.row?.defaultPaymentTermsDays ?? null,
      defaultInvoiceTemplate: this.row?.defaultInvoiceTemplate ?? 'classic',
      invoiceType: this.row?.invoiceType ?? 'general',
      customFieldKeys: this.row?.customFieldKeys ?? [],
      customUnits: updated,
      updatedAt: now,
    };
    return updated;
  }

  async reserveNextInvoiceNumber(): Promise<string> {
    const now = new Date().toISOString();
    const businessCode = this.row?.businessCode ?? generateBusinessCode();
    const invoicePrefix = this.row?.invoicePrefix ?? 'INV-';
    const nextInvoiceNumber = this.row?.nextInvoiceNumber ?? 1;
    const invoiceNumber = formatNextInvoiceNumber(invoicePrefix, businessCode, nextInvoiceNumber);
    this.row = {
      id: this.row?.id ?? generateLocalId('biz_'),
      businessCode,
      businessName: this.row?.businessName ?? '',
      logoUri: this.row?.logoUri ?? null,
      address: this.row?.address ?? null,
      phone: this.row?.phone ?? null,
      email: this.row?.email ?? null,
      website: this.row?.website ?? null,
      currency: this.row?.currency ?? 'USD',
      taxId: this.row?.taxId ?? null,
      invoicePrefix,
      nextInvoiceNumber: nextInvoiceNumber + 1,
      defaultTaxRate: this.row?.defaultTaxRate ?? null,
      defaultPaymentTermsDays: this.row?.defaultPaymentTermsDays ?? null,
      defaultInvoiceTemplate: this.row?.defaultInvoiceTemplate ?? 'classic',
      invoiceType: this.row?.invoiceType ?? 'general',
      customFieldKeys: this.row?.customFieldKeys ?? [],
      customUnits: this.row?.customUnits ?? { ...EMPTY_CUSTOM_UNITS },
      updatedAt: now,
    };
    return invoiceNumber;
  }
}
