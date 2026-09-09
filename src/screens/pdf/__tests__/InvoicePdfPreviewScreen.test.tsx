import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { InMemoryBusinessRepository } from '@/data/business/InMemoryBusinessRepository';
import { InMemoryCustomerRepository } from '@/data/customer/InMemoryCustomerRepository';
import { InMemoryInvoiceRepository } from '@/data/invoice/InMemoryInvoiceRepository';
import { InMemoryPaymentRepository } from '@/data/payment/InMemoryPaymentRepository';
import { FakePdfService } from '@/data/pdf/FakePdfService';
import type { InvoiceShareLinkService } from '@/data/shareLink/InvoiceShareLinkService';
import { EMPTY_INVOICE_ITEM_INPUT, type InvoiceInput } from '@/domain/invoice/types';
import { createPdfStore } from '@/state/pdfStore';

let mockPdfStore: ReturnType<typeof createPdfStore>;

jest.mock('@/state/pdfStore', () => {
  const actual = jest.requireActual('@/state/pdfStore');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usePdfStore: (...args: unknown[]) => (mockPdfStore as any)(...args),
  };
});

import { InvoicePdfPreviewScreen } from '../InvoicePdfPreviewScreen';

function makeInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    customerId: 'cust_1',
    customerName: 'Acme Co',
    invoiceTypeId: 'general',
    issueDate: '2026-06-01',
    dueDate: '2099-01-01',
    notes: 'Thanks for your business',
    terms: 'Net 15',
    items: [{ ...EMPTY_INVOICE_ITEM_INPUT, itemName: 'Widget', quantity: 2, unitPrice: 50 }],
    ...overrides,
  };
}

async function setUp(overrides: Partial<InvoiceInput> = {}) {
  const invoices = new InMemoryInvoiceRepository();
  const created = await invoices.create('INV-1', makeInput(overrides));
  const businessRepository = new InMemoryBusinessRepository();
  await businessRepository.saveProfile({
    businessName: 'Acme Supplies',
    logoUri: null,
    address: '1 Main St',
    phone: '555-0000',
    email: 'a@b.test',
    website: null,
    currency: 'USD',
    taxId: null,
    invoicePrefix: 'INV-',
    nextInvoiceNumber: 2,
  });
  const pdfService = new FakePdfService();
  const shareLinkService: InvoiceShareLinkService = { getShareLink: () => 'invora://invoice/1' };
  mockPdfStore = createPdfStore({
    invoiceRepository: invoices,
    customerRepository: new InMemoryCustomerRepository([
      { id: 'cust_1', name: 'Acme Co', phone: '555-1111', email: 'acme@test.com', website: null, address: null, notes: null, createdAt: '', updatedAt: '' },
    ]),
    businessRepository,
    paymentRepository: new InMemoryPaymentRepository(),
    pdfService,
    invoiceShareLinkService: shareLinkService,
    resolveLogo: async () => null,
    shareText: jest.fn(async () => {}),
    openWhatsAppUrl: jest.fn(async () => {}),
  });
  return { invoiceId: created.id, pdfService };
}

async function renderScreen(invoiceId: string) {
  return render(
    <InvoicePdfPreviewScreen
      navigation={{} as never}
      route={{ params: { invoiceId } } as never}
    />,
  );
}

describe('InvoicePdfPreviewScreen', () => {
  it('shows a not-found state for a missing invoice', async () => {
    await setUp();
    const view = await renderScreen('missing');
    await waitFor(() => expect(view.getByTestId('pdf-preview-not-found')).toBeTruthy());
  });

  it('renders the business, customer, items, totals, notes and terms', async () => {
    const { invoiceId } = await setUp();
    const view = await renderScreen(invoiceId);

    await waitFor(() => expect(view.getByTestId('pdf-preview-screen')).toBeTruthy());
    expect(view.getByText('Acme Supplies')).toBeTruthy();
    expect(view.getByText('INV-1')).toBeTruthy();
    expect(view.getByText('Acme Co')).toBeTruthy();
    expect(view.getByText('Widget')).toBeTruthy();
    expect(view.getByText('Thanks for your business')).toBeTruthy();
    expect(view.getByText('Net 15')).toBeTruthy();
  });

  it('regenerates the PDF when a different template is picked', async () => {
    const { invoiceId, pdfService } = await setUp();
    const view = await renderScreen(invoiceId);
    await waitFor(() => expect(view.getByTestId('pdf-preview-screen')).toBeTruthy());

    expect(pdfService.generatedHtml).toHaveLength(1);
    fireEvent.press(view.getByTestId('pdf-template-picker-modern'));
    await waitFor(() => expect(pdfService.generatedHtml).toHaveLength(2));
  });

  it('"Preview PDF" opens the native print/preview UI for the generated file', async () => {
    const { invoiceId, pdfService } = await setUp();
    const view = await renderScreen(invoiceId);
    await waitFor(() => expect(view.getByTestId('pdf-preview-screen')).toBeTruthy());

    fireEvent.press(view.getByTestId('pdf-action-preview'));
    await waitFor(() => expect(pdfService.previewedUris).toHaveLength(1));
  });

  it('"Share PDF" opens the native share sheet for the generated file', async () => {
    const { invoiceId, pdfService } = await setUp();
    const view = await renderScreen(invoiceId);
    await waitFor(() => expect(view.getByTestId('pdf-preview-screen')).toBeTruthy());

    fireEvent.press(view.getByTestId('pdf-action-share'));
    await waitFor(() => expect(pdfService.sharedPdfCalls).toHaveLength(1));
  });
});
