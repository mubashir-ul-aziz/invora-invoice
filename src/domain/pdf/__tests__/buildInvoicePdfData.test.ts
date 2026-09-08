import type { BusinessProfile } from '@/domain/business/types';
import type { Customer } from '@/domain/customer/types';
import { sumInvoiceTotals } from '@/domain/invoice/calculations';
import type { Invoice, InvoiceItemSnapshot } from '@/domain/invoice/types';
import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';
import type { Payment } from '@/domain/payment/types';

import { buildInvoicePdfData } from '../buildInvoicePdfData';

const line: InvoiceItemSnapshot = {
  id: 'line-1',
  itemId: null,
  itemName: 'Steel Pipe',
  description: null,
  sku: null,
  quantity: 1,
  unit: 'pcs',
  weight: null,
  length: null,
  width: null,
  height: null,
  unitPrice: 1000,
  discountPercent: null,
  taxPercent: null,
  subtotal: 1000,
  discountAmount: 0,
  taxAmount: 0,
  lineTotal: 1000,
};

const invoice: Invoice = {
  id: 'inv-1',
  invoiceNumber: 'INV-1',
  customerId: 'cust-1',
  customerName: 'Acme Corp (snapshot)',
  invoiceTypeId: 'general',
  issueDate: '2026-01-01',
  dueDate: '2026-01-31',
  notes: 'Thanks for your business.',
  terms: 'Net 30',
  items: [line],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const business: BusinessProfile = {
  id: 'default',
  businessName: 'Invora Supplies',
  logoUri: null,
  address: '123 Main St',
  phone: '555-1234',
  email: 'hello@invora.test',
  website: 'https://invora.test',
  currency: 'USD',
  taxId: 'TAX-1',
  invoicePrefix: 'INV-',
  nextInvoiceNumber: 2,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const customer: Customer = {
  id: 'cust-1',
  name: 'Acme Corp',
  phone: '555-5678',
  email: 'billing@acme.test',
  address: '456 Side St',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const fieldConfig = resolveInvoiceFieldConfig({ invoiceTypeId: 'general', customFieldKeys: [] });

describe('buildInvoicePdfData', () => {
  it('assembles the brief\'s worked example: $1,000 invoice, $300 + $200 paid -> $500 remaining', () => {
    const totals = sumInvoiceTotals([line]);
    const payments: Payment[] = [
      { id: 'p1', invoiceId: 'inv-1', invoiceNumber: 'INV-1', customerId: 'cust-1', customerName: 'Acme Corp', amount: 300, paymentDate: '2026-01-05', method: 'cash', reference: null, notes: null, createdAt: '', updatedAt: '' },
      { id: 'p2', invoiceId: 'inv-1', invoiceNumber: 'INV-1', customerId: 'cust-1', customerName: 'Acme Corp', amount: 200, paymentDate: '2026-01-10', method: 'card', reference: null, notes: null, createdAt: '', updatedAt: '' },
    ];

    const data = buildInvoicePdfData({
      template: 'classic',
      invoice,
      totals,
      status: 'partial',
      payments,
      business,
      customer,
      fieldConfig,
      logoDataUri: null,
    });

    expect(data.payment.amountPaid).toBe(500);
    expect(data.payment.remaining).toBe(500);
    expect(data.payment.overpaid).toBe(0);
    expect(data.totals.grandTotal).toBe(1000);
    expect(data.business.businessName).toBe('Invora Supplies');
    expect(data.customer.name).toBe('Acme Corp');
    expect(data.invoiceNumber).toBe('INV-1');
    expect(data.statusLabel).toBe('Partial');
    expect(data.items).toBe(invoice.items);
  });

  it('falls back to a placeholder business name and the invoice\'s own customer-name snapshot when both are missing', () => {
    const totals = sumInvoiceTotals([line]);
    const data = buildInvoicePdfData({
      template: 'modern',
      invoice,
      totals,
      status: 'unpaid',
      payments: [],
      business: null,
      customer: null,
      fieldConfig,
      logoDataUri: null,
    });

    expect(data.business.businessName).toBe('Your Business');
    expect(data.customer.name).toBe('Acme Corp (snapshot)');
    expect(data.currency).toBe('USD');
    expect(data.payment.amountPaid).toBe(0);
    expect(data.payment.remaining).toBe(1000);
  });

  it('never re-derives the invoice items — passes the same frozen snapshot array through untouched', () => {
    const totals = sumInvoiceTotals([line]);
    const data = buildInvoicePdfData({
      template: 'compact',
      invoice,
      totals,
      status: 'unpaid',
      payments: [],
      business,
      customer,
      fieldConfig,
      logoDataUri: null,
    });
    expect(data.items).toEqual([line]);
  });
});
