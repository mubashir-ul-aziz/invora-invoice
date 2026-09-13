import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { InvoiceItemSnapshot } from '@/domain/invoice/types';
import type { PdfItemColumn } from '@/domain/pdf/itemColumns';
import { colors } from '@/theme/colors';

interface Props {
  item: InvoiceItemSnapshot;
  columns: PdfItemColumn[];
  currency: string;
  testID?: string;
}

/** Fixed width for every item-table cell (header and body alike), so columns always line up and a row never needs to wrap. */
export const PDF_ITEM_CELL_WIDTH = 110;

/**
 * One line of the in-app PDF preview's item table — renders exactly the
 * columns `getPdfItemColumns()` resolved for this invoice's field config
 * (see the "when applicable" requirement on Weight/Dimensions), so the
 * preview can never show a column the actual generated PDF wouldn't.
 *
 * Every cell has a fixed width and `numberOfLines={1}` so a line item always
 * stays on a single row — the parent (`InvoicePdfPreviewScreen`) wraps the
 * whole table in a horizontal `ScrollView` so extra columns scroll sideways
 * on a narrow screen instead of wrapping onto a second row.
 */
export function PdfLineItemRow({ item, columns, currency, testID }: Props) {
  return (
    <View style={styles.row} testID={testID}>
      {columns.map((column) => (
        <View key={column.key} style={styles.cell}>
          <Text
            style={[styles.cellValue, column.align === 'right' && styles.cellValueRight]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {column.render(item, currency) || '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cell: { width: PDF_ITEM_CELL_WIDTH, paddingRight: 8, justifyContent: 'center' },
  cellValue: { fontSize: 13, color: colors.text },
  cellValueRight: { textAlign: 'right' },
});
