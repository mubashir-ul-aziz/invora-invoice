import type { BackupTables } from './types';

/**
 * Shared test-only helper for building `BackupTables` fixtures. Real rows
 * are Drizzle's full `$inferSelect` shape (every column), which is exactly
 * right for production code but needlessly verbose for tests that only care
 * about a couple of fields (e.g. `id`/`name`) — so overrides here are
 * intentionally loose and cast to `BackupTables` at the boundary, the same
 * way a hand-rolled JSON fixture would be in a real backup file.
 */
export function emptyBackupTables(): BackupTables {
  return {
    business: [],
    socialLinks: [],
    items: [],
    customers: [],
    invoices: [],
    invoiceItems: [],
    payments: [],
  };
}

export function tablesWith(overrides: Partial<Record<keyof BackupTables, unknown[]>> = {}): BackupTables {
  return { ...emptyBackupTables(), ...overrides } as BackupTables;
}

const T = 1_700_000_000_000;

/**
 * A complete, relationship-valid dataset with every column filled in the
 * way the database returns it — for round-trip tests that must pass the
 * full field/relationship validation in `validateBackupPayload()`.
 */
export function realisticBackupTables(): BackupTables {
  return {
    business: [
      {
        id: 'default',
        name: 'Acme Tiles',
        ownerName: 'Sam',
        logoUri: null,
        phone: '+1 555 0100',
        email: 'hello@acme.test',
        website: null,
        address: '1 Main St',
        currency: 'EUR',
        taxId: 'VAT-1',
        shareSlug: 'acme-slug',
        businessCode: '483920',
        invoicePrefix: 'ACM-',
        nextInvoiceNumber: 3,
        defaultTaxRate: 20,
        defaultPaymentTermsDays: 14,
        defaultInvoiceTemplate: 'modern',
        invoiceType: 'area',
        customInvoiceFields: null,
        customUnits: '{"generic":["box"]}',
        createdAt: T,
        updatedAt: T + 1,
      },
    ],
    socialLinks: [{ id: 's1', businessId: 'default', platform: 'whatsapp', value: '+15550100' }],
    items: [
      {
        id: 'i1',
        name: 'Tile',
        description: null,
        sku: 'T-1',
        unit: 'm2',
        defaultPrice: 12.5,
        priceMode: 'unit',
        taxRate: 20,
        weight: null,
        weightUnit: null,
        length: 1,
        width: 1,
        height: null,
        lengthUnit: 'm',
        invoiceType: 'area',
        createdAt: T,
        updatedAt: T,
      },
    ],
    customers: [
      { id: 'c1', name: 'Bob', phone: null, email: 'bob@x.test', website: null, address: null, notes: null, createdAt: T, updatedAt: T },
    ],
    invoices: [
      {
        id: 'inv1',
        invoiceNumber: 'ACM-483920-1',
        customerId: 'c1',
        customerName: 'Bob',
        invoiceType: 'area',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        notes: null,
        terms: null,
        currency: 'GBP',
        createdAt: T + 10,
        updatedAt: T + 20,
      },
    ],
    invoiceItems: [
      {
        id: 'li1',
        invoiceId: 'inv1',
        itemId: 'i1',
        pricingMethod: 'area',
        sortOrder: 0,
        itemName: 'Tile (snapshot name)',
        description: null,
        sku: 'T-1',
        quantity: 4,
        unit: 'm2',
        weight: null,
        weightUnit: null,
        length: 2,
        width: 2,
        height: null,
        lengthUnit: 'm',
        timeUnit: null,
        priceMode: 'unit',
        unitPrice: 10,
        discountPercent: null,
        taxPercent: 20,
        subtotal: 40,
        discountAmount: 0,
        taxAmount: 8,
        lineTotal: 48,
      },
    ],
    payments: [
      {
        id: 'p1',
        invoiceId: 'inv1',
        invoiceNumber: 'ACM-483920-1',
        customerId: 'c1',
        customerName: 'Bob',
        amount: 20,
        paymentDate: '2026-10-02',
        method: 'cash',
        reference: null,
        notes: null,
        createdAt: T + 30,
        updatedAt: T + 30,
      },
    ],
  };
}
