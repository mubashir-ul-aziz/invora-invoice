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

/**
 * One line of the in-app PDF preview's item table — renders exactly the
 * columns `getPdfItemColumns()` resolved for this invoice's field config
 * (see the "when applicable" requirement on Weight/Dimensions), so the
 * preview can never show a column the actual generated PDF wouldn't.
 */
export function PdfLineItemRow({ item, columns, currency, testID }: Props) {
  return (
    <View style={styles.row} testID={testID}>
      {columns.map((column) => (
        <View key={column.key} style={styles.cell}>
          <Text style={styles.cellLabel}>{column.label}</Text>
          <Text style={[styles.cellValue, column.align === 'right' && styles.cellValueRight]} numberOfLines={2}>
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
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cell: { minWidth: 70 },
  cellLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' },
  cellValue: { fontSize: 13, color: colors.text, marginTop: 2 },
  cellValueRight: { textAlign: 'right' },
});
