import { and, eq, like, or } from 'drizzle-orm';

import { normalizeLegacyInvoiceTypeId } from '@/domain/invoiceType/invoiceTypeRegistry';
import { EMPTY_ITEM_FILTER, type Item, type ItemFilter, type ItemInput } from '@/domain/item/types';
import { generateLocalId } from '@/lib/id';

import { getDatabase, getDrizzle } from '../db/client';
import { item } from '../db/schema';
import type { ItemRepository } from './ItemRepository';

function toItem(row: typeof item.$inferSelect): Item {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sku: row.sku,
    unit: row.unit,
    defaultPrice: row.defaultPrice,
    taxRate: row.taxRate,
    weight: row.weight,
    weightUnit: row.weightUnit,
    length: row.length,
    width: row.width,
    height: row.height,
    lengthUnit: row.lengthUnit,
    invoiceTypeId: normalizeLegacyInvoiceTypeId(row.invoiceType),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Real implementation of `ItemRepository` against the `item` table
 * (`db/schema.ts`). No Jest coverage — Jest can't drive the native SQLite
 * module without a device, same as every other Sqlite* repository in this
 * codebase; the search/filter semantics it implements in SQL are unit-tested
 * once, in plain TypeScript, via `domain/item/filtering.ts`'s
 * `itemMatchesFilter`, which `InMemoryItemRepository` runs directly.
 */
export class SqliteItemRepository implements ItemRepository {
  async list(filter: ItemFilter = EMPTY_ITEM_FILTER): Promise<Item[]> {
    await getDatabase();
    const db = getDrizzle();

    const conditions = [];
    if (filter.invoiceTypeId !== 'all') {
      conditions.push(eq(item.invoiceType, filter.invoiceTypeId));
    }
    const query = filter.searchText.trim();
    if (query) {
      const pattern = `%${query}%`;
      conditions.push(
        or(like(item.name, pattern), like(item.sku, pattern), like(item.description, pattern)),
      );
    }

    const rows = await db
      .select()
      .from(item)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(item.name);

    return rows.map(toItem);
  }

  async getById(id: string): Promise<Item | null> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(item).where(eq(item.id, id));
    const row = rows[0];
    return row ? toItem(row) : null;
  }

  async create(input: ItemInput): Promise<Item> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const values = {
      id: generateLocalId('item_'),
      name: input.name,
      description: input.description,
      sku: input.sku,
      unit: input.unit,
      defaultPrice: input.defaultPrice,
      taxRate: input.taxRate,
      weight: input.weight,
      weightUnit: input.weightUnit,
      length: input.length,
      width: input.width,
      height: input.height,
      lengthUnit: input.lengthUnit,
      invoiceType: input.invoiceTypeId,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(item).values(values);

    const created = await this.getById(values.id);
    if (!created) {
      throw new Error('Failed to read back the item after creating it.');
    }
    return created;
  }

  async update(id: string, input: ItemInput): Promise<Item> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    await db
      .update(item)
      .set({
        name: input.name,
        description: input.description,
        sku: input.sku,
        unit: input.unit,
        defaultPrice: input.defaultPrice,
        taxRate: input.taxRate,
        weight: input.weight,
        weightUnit: input.weightUnit,
        length: input.length,
        width: input.width,
        height: input.height,
        lengthUnit: input.lengthUnit,
        invoiceType: input.invoiceTypeId,
        updatedAt: now,
      })
      .where(eq(item.id, id));

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error(`Item not found after update: ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await getDatabase();
    const db = getDrizzle();
    await db.delete(item).where(eq(item.id, id));
  }
}
