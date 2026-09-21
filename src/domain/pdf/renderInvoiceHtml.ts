import { escapeHtml, escapeHtmlMultiline } from './escapeHtml';
import { getPdfItemColumns, type PdfItemColumn } from './itemColumns';
import { formatMoney } from './money';
import { PDF_FOOTER_RESERVE } from './pageFooter';
import type { InvoicePdfData } from './types';

/**
 * One shared HTML document + item-table structure, styled per template via a
 * `tpl-<id>` class on `<body>` and this template's own CSS block — rather
 * than three near-duplicate HTML builders. This keeps every template
 * guaranteed to show the same *content* (per `MVP_BUILD_PLAN.md`'s PDF
 * content requirements) while still looking genuinely different: Classic is
 * a plain bordered black-and-white layout, Modern adds a colored header band
 * and accent-colored totals, Compact tightens every spacing/font-size value
 * for a denser, shorter document. Adding a fourth template later is one more
 * CSS block here, not a fourth HTML builder.
 */
const TEMPLATE_CSS: Record<InvoicePdfData['template'], string> = {
  classic: `
    body.tpl-classic { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; }
    .tpl-classic .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 10px; }
    .tpl-classic .invoice-title { font-size: 21px; letter-spacing: 1.5px; text-transform: uppercase; }
    .tpl-classic table.line-items { border: 1px solid #1a1a1a; }
    .tpl-classic table.line-items th, .tpl-classic table.line-items td { border: 1px solid #ccc; }
    .tpl-classic table.line-items th { background: #f0f0f0; }
    .tpl-classic .grand-total td { border-top: 2px solid #1a1a1a; }
  `,
  modern: `
    body.tpl-modern { font-family: 'Helvetica Neue', Arial, sans-serif; color: #171923; }
    .tpl-modern .header { background: #2952CC; color: #fff; padding: 14px 18px; border-radius: 10px; }
    .tpl-modern .header .muted, .tpl-modern .header .invoice-number { color: #E3E9FF; }
    .tpl-modern .invoice-title { font-size: 20px; font-weight: 700; }
    .tpl-modern table.line-items th { background: #EEF2FF; color: #2952CC; }
    .tpl-modern table.line-items td { border-bottom: 1px solid #E2E5EC; }
    .tpl-modern .grand-total td { color: #2952CC; }
  `,
  compact: `
    body.tpl-compact { font-family: Arial, Helvetica, sans-serif; color: #171923; }
    .tpl-compact .header { border-bottom: 1px solid #999; padding-bottom: 6px; }
    .tpl-compact .invoice-title { font-size: 19px; font-weight: 700; }
    .tpl-compact table.line-items th { border-bottom: 1px solid #999; }
    .tpl-compact table.line-items td { border-bottom: 1px solid #eee; }
  `,
};

const BASE_CSS = `
  @page { margin: 0 0 ${PDF_FOOTER_RESERVE}px 0; }
  * { box-sizing: border-box; }
  body { margin: 26px 30px; font-family: Arial, Helvetica, sans-serif; font-size: 8px; line-height: 1.4; color: #1a1a1a; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 14px; }
  .logo { max-height: 48px; max-width: 140px; object-fit: contain; margin-bottom: 6px; }
  .business-name { font-size: 14px; font-weight: 700; }
  .invoice-title { font-size: 19px; font-weight: 700; }
  .invoice-number { font-size: 9px; font-weight: 600; color: #444; margin-top: 2px; }
  .muted { color: #666; font-size: 7.5px; line-height: 1.4; }
  .section { margin-top: 12px; }
  .section-title {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #888;
    margin-bottom: 4px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .customer-name { font-size: 9px; font-weight: 700; }
  .details-row { font-size: 8.5px; margin-top: 2px; }

  /* Item table: a <colgroup> gives every column a fixed percentage of the
     full content width (page width minus body margin) computed from each
     column's relative weight (see itemColumns.ts) — so with table-layout:
     fixed the table always fits within the page and never clips, no matter
     how many optional columns a pricing method (e.g. Volume) turns on. Long
     text wraps inside its own cell instead of forcing horizontal overflow. */
  table.items { width: 100%; margin-top: 8px; border-collapse: collapse; table-layout: fixed; }
  table.items th { text-align: left; font-size: 7.5px; font-weight: 700; padding: 5px 6px; vertical-align: bottom; }
  table.items td { font-size: 7.5px; padding: 5px 6px; vertical-align: middle; }
  table.items td.num, table.items th.num { text-align: right; }
  table.line-items th, table.line-items td { white-space: normal; word-break: break-word; }
  table.line-items th.num, table.line-items td.num { white-space: nowrap; }
  table.line-items tbody tr { page-break-inside: avoid; break-inside: avoid; }
  table.line-items thead { display: table-header-group; }
  .item-name { font-size: 8.5px; font-weight: 600; }
  .item-desc { display: block; font-size: 6.5px; font-weight: 400; color: #777; line-height: 1.3; margin-top: 1px; }

  .totals { display: flex; justify-content: flex-end; margin-top: 12px; page-break-inside: avoid; break-inside: avoid; }
  table.totals-table { min-width: 220px; font-size: 8px; }
  table.totals-table td { padding: 3px 8px; }
  table.totals-table td:first-child { color: #555; }
  table.totals-table td:last-child { text-align: right; font-variant-numeric: tabular-nums; font-size: 9px; }
  table.totals-table tr.grand-total td { font-size: 11px; font-weight: 700; }
  .status-badge { display: inline-block; padding: 2px 9px; border-radius: 10px; font-size: 8px; font-weight: 700; background: #EEF2FF; color: #2952CC; }

  .payment-history { margin-top: 14px; page-break-inside: avoid; break-inside: avoid; }
  table.payments th { font-size: 7.5px; font-weight: 700; }
  table.payments td { font-size: 7.5px; }
  table.payments td.num, table.payments th.num { white-space: nowrap; }
  table.payments td:first-child, table.payments th:first-child { white-space: nowrap; }
  table.payments td:nth-child(2), table.payments th:nth-child(2) { white-space: nowrap; }
  table.payments td:nth-child(3), table.payments th:nth-child(3) { white-space: normal; word-break: break-word; }

  .notes-terms { display: flex; gap: 20px; margin-top: 14px; page-break-inside: avoid; break-inside: avoid; }
  .notes-terms > div { flex: 1; font-size: 7.5px; line-height: 1.4; }
  .two-col { display: flex; justify-content: space-between; gap: 20px; }
`;

function addressBlock(lines: (string | null)[]): string {
  return lines
    .filter((line): line is string => !!line)
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('');
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString();
}

/**
 * Column percentages for the item table's `<colgroup>`, computed from each
 * column's relative `width` weight (see `itemColumns.ts`) so they always sum
 * to 100% regardless of how many optional columns are present — this, plus
 * `table-layout: fixed` in the CSS, is what guarantees the table never runs
 * past the page's right margin.
 */
function columnWidthPercentages(columns: PdfItemColumn[]): number[] {
  const totalWeight = columns.reduce((sum, col) => sum + col.width, 0);
  return columns.map((col) => (col.width / totalWeight) * 100);
}

/** The only place invoice PDF HTML is generated — see the module doc comment for why one shared builder serves all three templates. */
export function renderInvoiceHtml(data: InvoicePdfData): string {
  const columns = getPdfItemColumns(data.fieldConfig);
  const hasDescriptionField = data.fieldConfig.fields.some((field) => field.key === 'description');
  const columnWidths = columnWidthPercentages(columns);

  const colgroup = columnWidths.map((pct) => `<col style="width:${pct.toFixed(2)}%" />`).join('');

  const headerRow = columns
    .map((col) => `<th class="${col.align === 'right' ? 'num' : ''}">${escapeHtml(col.label)}</th>`)
    .join('');

  const bodyRows = data.items
    .map((item) => {
      const cells = columns
        .map((col) => {
          const value = col.render(item, data.currency);
          const isNameColumn = col.key === 'itemName';
          const cellValue = isNameColumn ? `<span class="item-name">${escapeHtml(value)}</span>` : escapeHtml(value);
          const description = isNameColumn && hasDescriptionField && item.description
            ? `<span class="item-desc">${escapeHtml(item.description)}</span>`
            : '';
          return `<td class="${col.align === 'right' ? 'num' : ''}">${cellValue}${description}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const paymentRows = data.payments
    .map(
      (payment) =>
        `<tr><td>${escapeHtml(formatDate(payment.paymentDate))}</td><td>${escapeHtml(payment.methodLabel)}</td><td>${escapeHtml(payment.reference || '-')}</td><td class="num">${escapeHtml(formatMoney(payment.amount, data.currency))}</td></tr>`,
    )
    .join('');

  const paymentHistorySection = data.payments.length
    ? `<div class="section payment-history">
    <div class="section-title">Payment History</div>
    <table class="items payments">
      <colgroup><col style="width:16%" /><col style="width:22%" /><col style="width:42%" /><col style="width:20%" /></colgroup>
      <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="num">Amount</th></tr></thead>
      <tbody>${paymentRows}</tbody>
    </table>
  </div>`
    : '';

  const remainingOrOverpaidRow =
    data.payment.overpaid > 0
      ? `<tr><td>Overpaid</td><td>${escapeHtml(formatMoney(data.payment.overpaid, data.currency))}</td></tr>`
      : `<tr><td>Remaining</td><td>${escapeHtml(formatMoney(data.payment.remaining, data.currency))}</td></tr>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>${BASE_CSS}${TEMPLATE_CSS[data.template]}</style>
</head>
<body class="tpl-${data.template}">
  <div class="header">
    <div>
      ${data.logoDataUri ? `<img class="logo" src="${data.logoDataUri}" />` : ''}
      <div class="business-name">${escapeHtml(data.business.businessName)}</div>
      <div class="muted">${addressBlock([
        data.business.address,
        data.business.phone,
        data.business.email,
        data.business.website,
        data.business.taxId ? `Tax ID: ${data.business.taxId}` : null,
      ])}</div>
    </div>
    <div style="text-align:right">
      <div class="invoice-title">Invoice</div>
      <div class="invoice-number">${escapeHtml(data.invoiceNumber)}</div>
      <div style="margin-top:6px" class="status-badge">${escapeHtml(data.statusLabel)}</div>
    </div>
  </div>

  <div class="section two-col">
    <div>
      <div class="section-title">Bill to</div>
      <div class="customer-name">${escapeHtml(data.customer.name)}</div>
      <div class="muted">${addressBlock([data.customer.address, data.customer.phone, data.customer.email, data.customer.website])}</div>
    </div>
    <div style="text-align:right">
      <div class="section-title">Details</div>
      <div class="details-row">Invoice date: ${escapeHtml(formatDate(data.issueDate))}</div>
      ${data.dueDate ? `<div class="details-row">Due date: ${escapeHtml(formatDate(data.dueDate))}</div>` : ''}
    </div>
  </div>

  <table class="items line-items">
    <colgroup>${colgroup}</colgroup>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="totals">
    <table class="totals-table">
      <tr><td>Subtotal</td><td>${escapeHtml(formatMoney(data.totals.subtotal, data.currency))}</td></tr>
      ${data.totals.discountTotal ? `<tr><td>Discount</td><td>-${escapeHtml(formatMoney(data.totals.discountTotal, data.currency))}</td></tr>` : ''}
      ${data.totals.taxTotal ? `<tr><td>Tax</td><td>${escapeHtml(formatMoney(data.totals.taxTotal, data.currency))}</td></tr>` : ''}
      <tr class="grand-total"><td>Total</td><td>${escapeHtml(formatMoney(data.totals.grandTotal, data.currency))}</td></tr>
      <tr><td>Paid</td><td>${escapeHtml(formatMoney(data.payment.amountPaid, data.currency))}</td></tr>
      ${remainingOrOverpaidRow}
    </table>
  </div>

  ${paymentHistorySection}

  <div class="notes-terms">
    ${data.notes ? `<div><div class="section-title">Notes</div><div>${escapeHtmlMultiline(data.notes)}</div></div>` : ''}
    ${data.terms ? `<div><div class="section-title">Terms</div><div>${escapeHtmlMultiline(data.terms)}</div></div>` : ''}
  </div>
</body>
</html>`;
}
