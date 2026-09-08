import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import { FakePdfService } from '@/data/pdf/FakePdfService';
import type { InvoiceShareLinkService } from '@/data/shareLink/InvoiceShareLinkService';
import type { Customer } from '@/domain/customer/types';
import type { Invoice } from '@/domain/invoice/types';
import type { Payment } from '@/domain/payment/types';

import { createPdfStore } from '../pdfStore';

const customer: Customer = {
  id: 'cust_1',
  name: 'Acme Corp',
  phone: '+1 555 0100',
  email: 'billing@acme.test',
  address: '456 Side St',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const invoice: Invoice = {
  id: 'inv_1',
  invoiceNumber: 'INV-1',
  customerId: 'cust_1',
  customerName: 'Acme Corp',
  invoiceTypeId: 'general',
  issueDate: '2026-01-01',
  dueDate: '2026-01-31',
  notes: null,
  terms: null,
  items: [
    {
      id: 'line_1',
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
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function seedBusinessRepository(): Promise<InMemoryBusinessRepository> {
  const repo = new InMemoryBusinessRepository();
  await repo.saveProfile({
    businessName: 'Invora Supplies',
    logoUri: null,
    address: '123 Main St',
    phone: '555-1234',
    email: 'hello@invora.test',
    website: null,
    currency: 'USD',
    taxId: 'TAX-1',
    invoicePrefix: 'INV-',
    nextInvoiceNumber: 2,
  });
  return repo;
}

async function buildStore(options: { payments?: Payment[]; shareLink?: string } = {}) {
  const pdfService = new FakePdfService();
  const shareLinkService: InvoiceShareLinkService = {
    getShareLink: jest.fn(() => options.shareLink ?? 'invora://invoice/inv_1'),
  };
  const shareText = jest.fn(async (_message: string) => {});
  const openWhatsAppUrl = jest.fn(async (_url: string) => {});

  const store = createPdfStore({
    invoiceRepository: new InMemoryInvoiceRepository([invoice]),
    customerRepository: new InMemoryCustomerRepository([customer]),
    businessRepository: await seedBusinessRepository(),
    paymentRepository: new InMemoryPaymentRepository(options.payments ?? []),
    pdfService,
    invoiceShareLinkService: shareLinkService,
    resolveLogo: async () => null,
    shareText,
    openWhatsAppUrl,
  });

  return { store, pdfService, shareLinkService, shareText, openWhatsAppUrl };
}

describe('pdfStore', () => {
  it('loads an invoice and generates a PDF using the business default template', async () => {
    const { store, pdfService } = await buildStore();
    await store.getState().loadForInvoice('inv_1');
    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.data?.template).toBe('classic');
    expect(state.pdfUri).toBe('file://fake/invoice-1.pdf');
    expect(pdfService.generatedHtml).toHaveLength(1);
    expect(pdfService.generatedHtml[0]).toContain('INV-1');
  });

  it('sets not-found for a missing invoice', async () => {
    const { store } = await buildStore();
    await store.getState().loadForInvoice('does-not-exist');
    expect(store.getState().status).toBe('not-found');
  });

  it('re-renders and regenerates the PDF when the template changes', async () => {
    const { store, pdfService } = await buildStore();
    await store.getState().loadForInvoice('inv_1');
    await store.getState().setTemplate('modern');
    const state = store.getState();
    expect(state.data?.template).toBe('modern');
    expect(state.pdfUri).toBe('file://fake/invoice-2.pdf');
    expect(pdfService.generatedHtml).toHaveLength(2);
  });

  it('assembles the brief\'s worked example — $1,000 invoice, $300 + $200 paid -> $500 remaining', async () => {
    const payments: Payment[] = [
      { id: 'p1', invoiceId: 'inv_1', invoiceNumber: 'INV-1', customerId: 'cust_1', customerName: 'Acme Corp', amount: 300, paymentDate: '2026-01-05', method: 'cash', reference: null, notes: null, createdAt: '', updatedAt: '' },
      { id: 'p2', invoiceId: 'inv_1', invoiceNumber: 'INV-1', customerId: 'cust_1', customerName: 'Acme Corp', amount: 200, paymentDate: '2026-01-10', method: 'card', reference: null, notes: null, createdAt: '', updatedAt: '' },
    ];
    const { store } = await buildStore({ payments });
    await store.getState().loadForInvoice('inv_1');
    const { data } = store.getState();
    expect(data?.payment.amountPaid).toBe(500);
    expect(data?.payment.remaining).toBe(500);
  });

  it('previewPdf/sharePdf delegate to the injected PdfService with the generated file', async () => {
    const { store, pdfService } = await buildStore();
    await store.getState().loadForInvoice('inv_1');
    await store.getState().previewPdf();
    await store.getState().sharePdf();
    expect(pdfService.previewedUris).toEqual(['file://fake/invoice-1.pdf']);
    expect(pdfService.sharedPdfCalls).toEqual([{ uri: 'file://fake/invoice-1.pdf', options: { dialogTitle: 'INV-1' } }]);
  });

  it('shareViaEmail attaches the PDF and addresses the customer\'s own email', async () => {
    const { store, pdfService } = await buildStore();
    await store.getState().loadForInvoice('inv_1');
    await store.getState().shareViaEmail();
    expect(pdfService.emailCalls).toHaveLength(1);
    expect(pdfService.emailCalls[0].uri).toBe('file://fake/invoice-1.pdf');
    expect(pdfService.emailCalls[0].options.recipients).toEqual(['billing@acme.test']);
    expect(pdfService.emailCalls[0].options.subject).toContain('INV-1');
  });

  it('shareViaWhatsApp opens a wa.me link addressed to the customer\'s own number with a summary message', async () => {
    const { store, openWhatsAppUrl } = await buildStore();
    await store.getState().loadForInvoice('inv_1');
    await store.getState().shareViaWhatsApp();
    expect(openWhatsAppUrl).toHaveBeenCalledTimes(1);
    const [url] = openWhatsAppUrl.mock.calls[0];
    expect(url).toContain('https://wa.me/15550100');
    expect(decodeURIComponent(url)).toContain('INV-1');
  });

  it('shareLink shares the invoice share link as plain text', async () => {
    const { store, shareText, shareLinkService } = await buildStore();
    await store.getState().loadForInvoice('inv_1');
    await store.getState().shareLink();
    expect(shareLinkService.getShareLink).toHaveBeenCalledWith(invoice);
    expect(shareText).toHaveBeenCalledWith('invora://invoice/inv_1');
  });
});
