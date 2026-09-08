import type { FieldKey } from '@/domain/invoiceType/fieldCatalog';
import type { InvoiceItemSnapshot } from '@/domain/invoice/types';
import type { InvoiceFieldConfig } from '@/domain/invoiceType/types';

import { formatMoney } from './money';

export interface PdfItemColumn {
  key: FieldKey | 'total';
  label: string;
  align: 'left' | 'right';
  render: (item: InvoiceItemSnapshot, currency: string) => string;
}

const OPTIONAL_COLUMNS: Record<
  Exclude<FieldKey, 'itemName' | 'description' | 'unitPrice'>,
  PdfItemColumn
> = {
  sku: { key: 'sku', label: 'SKU', align: 'left', render: (item) => item.sku ?? '' },
  quantity: {
    key: 'quantity',
    label: 'Qty',
    align: 'right',
    render: (item) => (item.quantity ?? 1).toString(),
  },
  unit: { key: 'unit', label: 'Unit', align: 'left', render: (item) => item.unit ?? '' },
  weight: {
    key: 'weight',
    label: 'Weight',
    align: 'right',
    render: (item) => (item.weight != null ? item.weight.toString() : ''),
  },
  length: {
    key: 'length',
    label: 'Length',
    align: 'right',
    render: (item) => (item.length != null ? item.length.toString() : ''),
  },
  width: {
    key: 'width',
    label: 'Width',
    align: 'right',
    render: (item) => (item.width != null ? item.width.toString() : ''),
  },
  height: {
    key: 'height',
    label: 'Height',
    align: 'right',
    render: (item) => (item.height != null ? item.height.toString() : ''),
  },
  discount: {
    key: 'discount',
    label: 'Discount',
    align: 'right',
    render: (item, currency) => (item.discountAmount ? `-${formatMoney(item.discountAmount, currency)}` : '—'),
  },
  tax: {
    key: 'tax',
    label: 'Tax',
    align: 'right',
    render: (item, currency) => (item.taxAmount ? formatMoney(item.taxAmount, currency) : '—'),
  },
};

const ITEM_NAME_COLUMN: PdfItemColumn = {
  key: 'itemName',
  label: 'Item',
  align: 'left',
  render: (item) => item.itemName,
};

const UNIT_PRICE_COLUMN: PdfItemColumn = {
  key: 'unitPrice',
  label: 'Unit price',
  align: 'right',
  render: (item, currency) => formatMoney(item.unitPrice, currency),
};

const TOTAL_COLUMN: PdfItemColumn = {
  key: 'total',
  label: 'Total',
  align: 'right',
  render: (item, currency) => formatMoney(item.lineTotal, currency),
};

/**
 * Turns a resolved `InvoiceFieldConfig` (General/Quantity/Weight/Dimension/
 * Custom — see `domain/invoiceType/types.ts`) into the concrete list of PDF
 * table columns to render, in the field catalog's canonical order. Item Name
 * and Unit Price always appear (they're `alwaysIncluded` in the catalog);
 * Weight/Length/Width/Height/SKU/Quantity/Unit/Discount/Tax only appear when
 * that invoice's own field set actually includes them — this is the "Weight
 * when applicable" / "Dimensions when applicable" requirement, driven by the
 * same registry the invoice-entry screens already use (no second, hard-coded
 * "which columns does this invoice type show" list). `Description` is
 * rendered as a sub-line under the item name (see `renderInvoiceHtml.ts`)
 * rather than its own column, and `Total` is always appended last — neither
 * is a selectable field in the catalog, they're structural to every invoice
 * line.
 */
export function getPdfItemColumns(fieldConfig: InvoiceFieldConfig): PdfItemColumn[] {
  const keys = new Set(fieldConfig.fields.map((field) => field.key));
  const optional = (Object.keys(OPTIONAL_COLUMNS) as (keyof typeof OPTIONAL_COLUMNS)[])
    .filter((key) => keys.has(key))
    .map((key) => OPTIONAL_COLUMNS[key]);
  return [ITEM_NAME_COLUMN, ...optional, UNIT_PRICE_COLUMN, TOTAL_COLUMN];
}
