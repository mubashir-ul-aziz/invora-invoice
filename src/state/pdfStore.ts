import { create } from 'zustand';
import { Linking, Share } from 'react-native';

import type { BusinessRepository } from '@/data/business/BusinessRepository';
import {
  getBusinessRepository,
  getCustomerRepository,
  getInvoiceRepository,
  getInvoiceShareLinkService,
  getPaymentRepository,
  getPdfService,
} from '@/data/container';
import type { CustomerRepository } from '@/data/customer/CustomerRepository';
import type { InvoiceRepository } from '@/data/invoice/InvoiceRepository';
import type { PaymentRepository } from '@/data/payment/PaymentRepository';
import type { PdfService } from '@/data/pdf/PdfService';
import type { InvoiceShareLinkService } from '@/data/shareLink/InvoiceShareLinkService';
import { normalizePhoneDigits } from '@/domain/businessCard/validation';
import type { InvoiceTemplate } from '@/domain/business/types';
import { sumInvoiceTotals } from '@/domain/invoice/calculations';
import { computeInvoiceStatus } from '@/domain/invoice/status';
import type { Invoice } from '@/domain/invoice/types';
import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';
import { sumPayments } from '@/domain/payment/calculations';
import { buildInvoicePdfData } from '@/domain/pdf/buildInvoicePdfData';
import { renderInvoiceHtml } from '@/domain/pdf/renderInvoiceHtml';
import type { InvoicePdfData } from '@/domain/pdf/types';
import { resolveLogoDataUri } from '@/lib/fileToDataUri';

export type PdfStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not-found';

interface PdfState {
  status: PdfStatus;
  error: string | null;
  invoice: Invoice | null;
  data: InvoicePdfData | null;
  pdfUri: string | null;
  /** Loads everything an invoice's PDF needs and generates the initial file. `template` defaults to the business's own default invoice template. */
  loadForInvoice: (invoiceId: string, template?: InvoiceTemplate) => Promise<void>;
  /** Switches templates for the currently loaded invoice and regenerates the PDF file — the Preview screen's template picker. */
  setTemplate: (template: InvoiceTemplate) => Promise<void>;
  /** Opens the OS's native print/preview UI for the generated PDF — see `PdfService.previewPdf`. */
  previewPdf: () => Promise<void>;
  /** Opens the native share sheet for the generated PDF file (WhatsApp/Mail/Drive/etc. as OS-provided targets). */
  sharePdf: () => Promise<void>;
  isEmailAvailable: () => Promise<boolean>;
  /** Opens the native email composer with the PDF attached. */
  shareViaEmail: () => Promise<void>;
  /**
   * Opens WhatsApp with a pre-filled text message (invoice number, total,
   * balance, and the share link) — addressed to the customer's own number
   * when known, otherwise to WhatsApp's own contact picker. WhatsApp can't be
   * handed the PDF file itself through a URL scheme (see the doc comment on
   * `ExpoPdfService` for why file sharing goes through the OS share sheet
   * instead) — this is a real, distinct action (a text summary + link), not
   * a relabelled "Share PDF".
   */
  shareViaWhatsApp: () => Promise<void>;
  /** Text-only "Share link" action — mirrors `ShareCardScreen`'s use of the core `Share` API for the Digital Business Card's link. */
  shareLink: () => Promise<void>;
  getShareLink: () => string | null;
}

interface PdfStoreDeps {
  invoiceRepository: InvoiceRepository;
  customerRepository: CustomerRepository;
  businessRepository: BusinessRepository;
  paymentRepository: PaymentRepository;
  pdfService: PdfService;
  invoiceShareLinkService: InvoiceShareLinkService;
  /** Injectable so tests never touch `expo-file-system`; defaults to the real reader. */
  resolveLogo: (logoUri: string | null) => Promise<string | null>;
  /** Injectable so tests never touch `react-native`'s `Share`/`Linking`. */
  shareText: (message: string) => Promise<void>;
  openWhatsAppUrl: (url: string) => Promise<void>;
}

async function buildData(
  deps: PdfStoreDeps,
  invoice: Invoice,
  template: InvoiceTemplate,
): Promise<InvoicePdfData> {
  const [business, customer, payments, invoiceTypeSelection] = await Promise.all([
    deps.businessRepository.getProfile(),
    deps.customerRepository.getById(invoice.customerId),
    deps.paymentRepository.listByInvoice(invoice.id),
    deps.businessRepository.getInvoiceTypeSelection(),
  ]);

  const totals = sumInvoiceTotals(invoice.items);
  const amountPaid = sumPayments(payments);
  const status = computeInvoiceStatus({ grandTotal: totals.grandTotal, amountPaid, dueDate: invoice.dueDate });
  // The field config follows the invoice's own fixed type plus the business's
  // *current* custom-field selection — the same lookup `CreateInvoiceItemsScreen`
  // (Phase 6) already uses to redraw an existing invoice's line fields; a
  // custom field selection isn't itself snapshotted per invoice today.
  const fieldConfig = resolveInvoiceFieldConfig({
    invoiceTypeId: invoice.invoiceTypeId,
    customFieldKeys: invoiceTypeSelection?.customFieldKeys ?? [],
  });
  const logoDataUri = await deps.resolveLogo(business?.logoUri ?? null);

  return buildInvoicePdfData({
    template,
    invoice,
    totals,
    status,
    payments,
    business,
    customer,
    fieldConfig,
    logoDataUri,
  });
}

/**
 * Dependencies are resolved lazily (not at module-eval time) so tests can
 * swap every repository/service via `createPdfStore` before anything touches
 * the database or a native module — same pattern as every other store in
 * this codebase.
 */
export function createPdfStore(overrides: Partial<PdfStoreDeps> = {}) {
  const deps: PdfStoreDeps = {
    invoiceRepository: getInvoiceRepository(),
    customerRepository: getCustomerRepository(),
    businessRepository: getBusinessRepository(),
    paymentRepository: getPaymentRepository(),
    pdfService: getPdfService(),
    invoiceShareLinkService: getInvoiceShareLinkService(),
    resolveLogo: resolveLogoDataUri,
    shareText: async (message: string) => {
      await Share.share({ message });
    },
    openWhatsAppUrl: async (url: string) => {
      await Linking.openURL(url);
    },
    ...overrides,
  };

  return create<PdfState>((set, get) => ({
    status: 'idle',
    error: null,
    invoice: null,
    data: null,
    pdfUri: null,

    loadForInvoice: async (invoiceId, template) => {
      set({ status: 'loading', error: null, invoice: null, data: null, pdfUri: null });
      try {
        const invoice = await deps.invoiceRepository.getById(invoiceId);
        if (!invoice) {
          set({ status: 'not-found' });
          return;
        }
        const settings = await deps.businessRepository.getInvoiceSettings();
        const resolvedTemplate = template ?? settings?.defaultInvoiceTemplate ?? 'classic';
        const data = await buildData(deps, invoice, resolvedTemplate);
        const pdfUri = await deps.pdfService.generatePdf(renderInvoiceHtml(data));
        set({ invoice, data, pdfUri, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    setTemplate: async (template) => {
      const { invoice } = get();
      if (!invoice) {
        return;
      }
      set({ status: 'loading', error: null });
      try {
        const data = await buildData(deps, invoice, template);
        const pdfUri = await deps.pdfService.generatePdf(renderInvoiceHtml(data));
        set({ data, pdfUri, status: 'ready' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    },

    previewPdf: async () => {
      const { pdfUri } = get();
      if (!pdfUri) return;
      await deps.pdfService.previewPdf(pdfUri);
    },

    sharePdf: async () => {
      const { pdfUri, invoice } = get();
      if (!pdfUri) return;
      await deps.pdfService.sharePdf(pdfUri, { dialogTitle: invoice?.invoiceNumber });
    },

    isEmailAvailable: async () => deps.pdfService.isEmailAvailable(),

    shareViaEmail: async () => {
      const { pdfUri, invoice, data } = get();
      if (!pdfUri || !invoice || !data) return;
      await deps.pdfService.shareViaEmail(pdfUri, {
        subject: `Invoice ${invoice.invoiceNumber}`,
        body: `Please find invoice ${invoice.invoiceNumber} attached.`,
        recipients: data.customer.email ? [data.customer.email] : undefined,
      });
    },

    shareViaWhatsApp: async () => {
      const { invoice, data } = get();
      if (!invoice || !data) return;
      const message = `Invoice ${invoice.invoiceNumber} — Total ${data.totals.grandTotal.toFixed(2)} ${data.currency}, Remaining ${data.payment.remaining.toFixed(2)} ${data.currency}. ${deps.invoiceShareLinkService.getShareLink(invoice)}`;
      const target = data.customer.phone
        ? `https://wa.me/${normalizePhoneDigits(data.customer.phone).replace(/^\+/, '')}`
        : 'https://wa.me/';
      await deps.openWhatsAppUrl(`${target}?text=${encodeURIComponent(message)}`);
    },

    shareLink: async () => {
      const { invoice } = get();
      if (!invoice) return;
      await deps.shareText(deps.invoiceShareLinkService.getShareLink(invoice));
    },

    getShareLink: () => {
      const { invoice } = get();
      return invoice ? deps.invoiceShareLinkService.getShareLink(invoice) : null;
    },
  }));
}

/** App-wide singleton store, wired to the real repositories/services. */
export const usePdfStore = createPdfStore();
