import { escapeHtml, escapeHtmlMultiline } from './escapeHtml';
import { getPdfItemColumns } from './itemColumns';
import { formatMoney } from './money';
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
    .tpl-classic .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
    .tpl-classic .invoice-title { font-size: 26px; letter-spacing: 2px; text-transform: uppercase; }
    .tpl-classic table.items { border: 1px solid #1a1a1a; border-collapse: collapse; }
    .tpl-classic table.items th, .tpl-classic table.items td { border: 1px solid #999; padding: 8px 10px; }
    .tpl-classic table.items th { background: #f0f0f0; }
    .tpl-classic .totals-table td { padding: 4px 10px; }
    .tpl-classic .grand-total { font-size: 16px; font-weight: bold; border-top: 2px solid #1a1a1a; }
  `,
  modern: `
    body.tpl-modern { font-family: 'Helvetica Neue', Arial, sans-serif; color: #171923; }
    .tpl-modern .header { background: #2952CC; color: #fff; padding: 24px; border-radius: 10px; }
    .tpl-modern .header .muted { color: #E3E9FF; }
    .tpl-modern .invoice-title { font-size: 24px; font-weight: 700; }
    .tpl-modern table.items { border-collapse: collapse; width: 100%; }
    .tpl-modern table.items th { background: #EEF2FF; color: #2952CC; text-align: left; padding: 10px; }
    .tpl-modern table.items td { padding: 10px; border-bottom: 1px solid #E2E5EC; }
    .tpl-modern .totals-table td { padding: 5px 10px; }
    .tpl-modern .grand-total { font-size: 17px; font-weight: 700; color: #2952CC; }
  `,
  compact: `
    body.tpl-compact { font-family: Arial, Helvetica, sans-serif; color: #171923; font-size: 11px; }
    .tpl-compact .header { border-bottom: 1px solid #999; padding-bottom: 8px; }
    .tpl-compact .invoice-title { font-size: 16px; font-weight: 700; }
    .tpl-compact table.items { border-collapse: collapse; width: 100%; font-size: 10.5px; }
    .tpl-compact table.items th { text-align: left; border-bottom: 1px solid #999; padding: 4px 6px; }
    .tpl-compact table.items td { padding: 4px 6px; border-bottom: 1px solid #eee; }
    .tpl-compact .totals-table td { padding: 2px 6px; }
    .tpl-compact .grand-total { font-size: 12px; font-weight: 700; }
  `,
};

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
  .logo { max-height: 64px; max-width: 160px; object-fit: contain; margin-bottom: 8px; }
  .muted { color: #666; font-size: 12px; }
  .section { margin-top: 20px; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
  table.items { width: 100%; margin-top: 12px; }
  table.items th { text-align: left; }
  table.items td.num, table.items th.num { text-align: right; }
  .item-desc { display: block; font-size: 11px; color: #666; }
  .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
  table.totals-table { min-width: 260px; }
  table.totals-table td:first-child { color: #555; }
  table.totals-table td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #EEF2FF; color: #2952CC; }
  .notes-terms { display: flex; gap: 24px; margin-top: 24px; }
  .notes-terms > div { flex: 1; }
  .two-col { display: flex; justify-content: space-between; gap: 24px; }
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

/** The only place invoice PDF HTML is generated — see the module doc comment for why one shared builder serves all three templates. */
export function renderInvoiceHtml(data: InvoicePdfData): string {
  const columns = getPdfItemColumns(data.fieldConfig);
  const hasDescriptionField = data.fieldConfig.fields.some((field) => field.key === 'description');

  const headerRow = columns
    .map((col) => `<th class="${col.align === 'right' ? 'num' : ''}">${escapeHtml(col.label)}</th>`)
    .join('');

  const bodyRows = data.items
    .map((item) => {
      const cells = columns
        .map((col) => {
          const value = col.render(item, data.currency);
          const isNameColumn = col.key === 'itemName';
          const description = isNameColumn && hasDescriptionField && item.description
            ? `<span class="item-desc">${escapeHtml(item.description)}</span>`
            : '';
          return `<td class="${col.align === 'right' ? 'num' : ''}">${escapeHtml(value)}${description}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

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
      <div><strong>${escapeHtml(data.business.businessName)}</strong></div>
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
      <div class="muted">${escapeHtml(data.invoiceNumber)}</div>
      <div style="margin-top:8px" class="status-badge">${escapeHtml(data.statusLabel)}</div>
    </div>
  </div>

  <div class="section two-col">
    <div>
      <div class="section-title">Bill to</div>
      <div><strong>${escapeHtml(data.customer.name)}</strong></div>
      <div class="muted">${addressBlock([data.customer.address, data.customer.phone, data.customer.email])}</div>
    </div>
    <div style="text-align:right">
      <div class="section-title">Details</div>
      <div>Invoice date: ${escapeHtml(formatDate(data.issueDate))}</div>
      ${data.dueDate ? `<div>Due date: ${escapeHtml(formatDate(data.dueDate))}</div>` : ''}
    </div>
  </div>

  <table class="items">
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

  <div class="notes-terms">
    ${data.notes ? `<div><div class="section-title">Notes</div><div>${escapeHtmlMultiline(data.notes)}</div></div>` : ''}
    ${data.terms ? `<div><div class="section-title">Terms</div><div>${escapeHtmlMultiline(data.terms)}</div></div>` : ''}
  </div>
</body>
</html>`;
}
