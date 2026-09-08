import { and, desc, eq, like, or } from 'drizzle-orm';

import { sortPayments } from '@/domain/payment/filtering';
import {
  EMPTY_PAYMENT_FILTER,
  type Payment,
  type PaymentFilter,
  type PaymentInput,
  type PaymentMethod,
  type PaymentUpdateInput,
} from '@/domain/payment/types';
import { generateLocalId } from '@/lib/id';

import { getDatabase, getDrizzle } from '../db/client';
import { payment } from '../db/schema';
import type { PaymentRepository } from './PaymentRepository';

function toPayment(row: typeof payment.$inferSelect): Payment {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    customerId: row.customerId,
    customerName: row.customerName,
    amount: row.amount,
    paymentDate: row.paymentDate,
    method: row.method as PaymentMethod,
    reference: row.reference,
    notes: row.notes,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Real implementation of `PaymentRepository` against the `payment` table
 * (`db/schema.ts`). No Jest coverage — Jest can't drive the native SQLite
 * module without a device, same as every other Sqlite* repository in this
 * codebase; the search/filter semantics it implements are unit-tested once,
 * in plain TypeScript, via `domain/payment/filtering.ts`, which
 * `InMemoryPaymentRepository` also runs directly.
 */
export class SqlitePaymentRepository implements PaymentRepository {
  async list(filter: PaymentFilter = EMPTY_PAYMENT_FILTER): Promise<Payment[]> {
    await getDatabase();
    const db = getDrizzle();

    const conditions = [];
    if (filter.customerId) {
      conditions.push(eq(payment.customerId, filter.customerId));
    }
    if (filter.invoiceId) {
      conditions.push(eq(payment.invoiceId, filter.invoiceId));
    }
    if (filter.method !== 'all') {
      conditions.push(eq(payment.method, filter.method));
    }
    const query = filter.searchText.trim();
    if (query) {
      const pattern = `%${query}%`;
      conditions.push(
        or(like(payment.invoiceNumber, pattern), like(payment.customerName, pattern), like(payment.reference, pattern)),
      );
    }

    const rows = await db
      .select()
      .from(payment)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(payment.paymentDate));

    return sortPayments(rows.map(toPayment));
  }

  async listByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.list({ ...EMPTY_PAYMENT_FILTER, invoiceId });
  }

  async getById(id: string): Promise<Payment | null> {
    await getDatabase();
    const db = getDrizzle();
    const rows = await db.select().from(payment).where(eq(payment.id, id));
    const row = rows[0];
    return row ? toPayment(row) : null;
  }

  async create(input: PaymentInput): Promise<Payment> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    const values = {
      id: generateLocalId('pay_'),
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      customerId: input.customerId,
      customerName: input.customerName,
      amount: input.amount,
      paymentDate: input.paymentDate,
      method: input.method,
      reference: input.reference,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(payment).values(values);

    const created = await this.getById(values.id);
    if (!created) {
      throw new Error('Failed to read back the payment after creating it.');
    }
    return created;
  }

  async update(id: string, input: PaymentUpdateInput): Promise<Payment> {
    await getDatabase();
    const db = getDrizzle();

    const now = Date.now();
    await db
      .update(payment)
      .set({
        amount: input.amount,
        paymentDate: input.paymentDate,
        method: input.method,
        reference: input.reference,
        notes: input.notes,
        updatedAt: now,
      })
      .where(eq(payment.id, id));

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error(`Payment not found after update: ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await getDatabase();
    const db = getDrizzle();
    await db.delete(payment).where(eq(payment.id, id));
  }
}
