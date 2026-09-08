import { paymentMatchesFilter, sortPayments } from '@/domain/payment/filtering';
import {
  EMPTY_PAYMENT_FILTER,
  type Payment,
  type PaymentFilter,
  type PaymentInput,
  type PaymentUpdateInput,
} from '@/domain/payment/types';
import { generateLocalId } from '@/lib/id';

import type { PaymentRepository } from './PaymentRepository';

/**
 * Frontend-first mock repository — no database, no I/O. Used to build and
 * unit-test the Payments UI/state layer before the SQLite-backed repository
 * exists, and kept afterwards for fast Jest tests (same role as
 * `InMemoryInvoiceRepository`/`InMemoryCustomerRepository`).
 */
export class InMemoryPaymentRepository implements PaymentRepository {
  private payments: Payment[];

  constructor(seed: Payment[] = []) {
    this.payments = [...seed];
  }

  async list(filter: PaymentFilter = EMPTY_PAYMENT_FILTER): Promise<Payment[]> {
    return sortPayments(this.payments.filter((payment) => paymentMatchesFilter(payment, filter)));
  }

  async listByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.list({ ...EMPTY_PAYMENT_FILTER, invoiceId });
  }

  async getById(id: string): Promise<Payment | null> {
    return this.payments.find((payment) => payment.id === id) ?? null;
  }

  async create(input: PaymentInput): Promise<Payment> {
    const now = new Date().toISOString();
    const payment: Payment = {
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
    this.payments.push(payment);
    return payment;
  }

  async update(id: string, input: PaymentUpdateInput): Promise<Payment> {
    const index = this.payments.findIndex((payment) => payment.id === id);
    if (index === -1) {
      throw new Error(`Payment not found: ${id}`);
    }
    const updated: Payment = {
      ...this.payments[index],
      amount: input.amount,
      paymentDate: input.paymentDate,
      method: input.method,
      reference: input.reference,
      notes: input.notes,
      updatedAt: new Date().toISOString(),
    };
    this.payments[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.payments = this.payments.filter((payment) => payment.id !== id);
  }
}
