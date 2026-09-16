import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  label: string;
  testID?: string;
}

/**
 * Centered "Today" / "Yesterday" / date pill, rendered between groups of
 * rows on the Customer List and Invoice List screens — the same visual
 * pattern WhatsApp uses to separate a chat's messages by day. See
 * `domain/shared/dateSections.ts` for how the label and grouping are
 * computed.
 */
export function DateSectionHeader({ label, testID }: Props) {
  return (
    <View style={styles.wrapper} testID={testID}>
      <View style={styles.pill}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Opaque, screen-matching background: once `stickySectionHeadersEnabled`
  // pins this header to the top while scrolling, rows scrolling underneath
  // would otherwise show through the transparent gaps beside the pill.
  wrapper: { alignItems: 'center', paddingVertical: 8, backgroundColor: colors.background },
  pill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
});
