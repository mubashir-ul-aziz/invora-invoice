import { resolveInvoiceFieldConfig } from '@/domain/invoiceType/types';
import type { InvoiceItemSnapshot } from '@/domain/invoice/types';

import { buildInvoicePdfData } from '../buildInvoicePdfData';
import { renderInvoiceHtml } from '../renderInvoiceHtml';
import type { InvoiceTemplate } from '../types';

const weightLine: InvoiceItemSnapshot = {
  id: 'line-1',
  itemId: null,
  itemName: 'Copper Wire',
  description: 'High-grade copper wire, 2mm',
  sku: 'CW-2',
  quantity: 5,
  unit: 'kg',
  weight: 5,
  length: null,
  width: null,
  height: null,
  unitPrice: 20,
  discountPercent: 10,
  taxPercent: 8,
  subtotal: 100,
  discountAmount: 10,
  taxAmount: 7.2,
  lineTotal: 97.2,
};

function buildData(template: InvoiceTemplate) {
  return buildInvoicePdfData({
    template,
    invoice: {
      id: 'inv-1',
      invoiceNumber: 'INV-42',
      customerId: 'cust-1',
      customerName: 'Nuts & Bolts <Ltd>',
      invoiceTypeId: 'custom',
      issueDate: '2026-02-01',
      dueDate: '2026-03-01',
      notes: 'Line one\nLine two',
      terms: 'Due on receipt',
      items: [weightLine],
      createdAt: '',
      updatedAt: '',
    },
    totals: { subtotal: 100, discountTotal: 10, taxTotal: 7.2, grandTotal: 97.2 },
    status: 'unpaid',
    payments: [],
    business: {
      id: 'default',
      businessName: 'Acme & Co',
      logoUri: null,
      address: '1 Main St',
      phone: '555-0000',
      email: 'a@b.test',
      website: 'https://acme.test',
      currency: 'USD',
      taxId: 'TAX-9',
      businessCode: '483920',
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 43,
      updatedAt: '',
    },
    customer: null,
    fieldConfig: resolveInvoiceFieldConfig({
      invoiceTypeId: 'custom',
      customFieldKeys: ['itemName', 'sku', 'quantity', 'unit', 'weight', 'unitPrice', 'discount', 'tax'],
    }),
    logoDataUri: null,
  });
}

describe('renderInvoiceHtml', () => {
  it('includes every required PDF content field for the Classic template', () => {
    const html = renderInvoiceHtml(buildData('classic'));
    expect(html).toContain('Acme &amp; Co'); // business info
    expect(html).toContain('1 Main St'); // address
    expect(html).toContain('Tax ID: TAX-9');
    expect(html).toContain('Nuts &amp; Bolts &lt;Ltd&gt;'); // customer, escaped
    expect(html).toContain('INV-42'); // invoice number
    expect(html).toContain('Copper Wire'); // item
    expect(html).toContain('CW-2'); // sku
    expect(html).toContain('kg'); // unit
    expect(html).toContain('>5<'); // quantity and weight both render "5"
    expect(html).toContain('USD 20.00'); // unit price
    expect(html).toContain('-USD 10.00'); // discount
    expect(html).toContain('USD 7.20'); // tax
    expect(html).toContain('USD 97.20'); // grand total
    expect(html).toContain('Paid');
    expect(html).toContain('Remaining');
    expect(html).toContain('Line one<br>Line two'); // notes, newline-to-br
    expect(html).toContain('Due on receipt'); // terms
    expect(html).toContain('tpl-classic');
  });

  it('shows an "Overpaid" line instead of a negative Remaining once payments exceed the total', () => {
    const data = buildInvoicePdfData({
      template: 'modern',
      invoice: {
        id: 'inv-1',
        invoiceNumber: 'INV-1',
        customerId: 'c1',
        customerName: 'Customer',
        invoiceTypeId: 'general',
        issueDate: '2026-01-01',
        dueDate: null,
        notes: null,
        terms: null,
        items: [
          { ...weightLine, discountAmount: 0, taxAmount: 0, subtotal: 100, lineTotal: 100 },
        ],
        createdAt: '',
        updatedAt: '',
      },
      totals: { subtotal: 100, discountTotal: 0, taxTotal: 0, grandTotal: 100 },
      status: 'paid',
      payments: [
        { id: 'p1', invoiceId: 'inv-1', invoiceNumber: 'INV-1', customerId: 'c1', customerName: 'Customer', amount: 150, paymentDate: '2026-01-02', method: 'cash', reference: null, notes: null, createdAt: '', updatedAt: '' },
      ],
      business: null,
      customer: null,
      fieldConfig: resolveInvoiceFieldConfig({ invoiceTypeId: 'general', customFieldKeys: [] }),
      logoDataUri: null,
    });
    const html = renderInvoiceHtml(data);
    expect(html).toContain('Overpaid');
    expect(html).not.toContain('>Remaining<');
    expect(html).toContain('tpl-modern');
  });

  it('renders the logo image only when a logo data URI is provided', () => {
    const withoutLogo = renderInvoiceHtml(buildData('compact'));
    expect(withoutLogo).not.toContain('<img');

    const dataWithLogo = { ...buildData('compact'), logoDataUri: 'data:image/png;base64,AAAA' };
    const withLogo = renderInvoiceHtml(dataWithLogo);
    expect(withLogo).toContain('<img class="logo" src="data:image/png;base64,AAAA" />');
  });

  it('renders a genuinely different style block per template', () => {
    const classic = renderInvoiceHtml(buildData('classic'));
    const modern = renderInvoiceHtml(buildData('modern'));
    const compact = renderInvoiceHtml(buildData('compact'));
    expect(classic).toContain('tpl-classic');
    expect(modern).toContain('tpl-modern');
    expect(compact).toContain('tpl-compact');
    // Each template's CSS block is distinct.
    expect(classic).not.toEqual(modern);
    expect(modern).not.toEqual(compact);
  });
});
