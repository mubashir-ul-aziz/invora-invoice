import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

/**
 * DESIGN ONLY: the Stitch mock shows an "HMRC Open Banking Connected" sync
 * banner. There is no open-banking / bank-reconciliation integration
 * anywhere in this app's backend or database, so this is presentational only
 * and never claims a real connection.
 */
export function DashboardSyncBanner() {
  return (
    <View style={styles.banner} testID="dashboard-sync-banner-design-only">
      <View style={styles.iconBox}>
        <Feather name="refresh-cw" size={15} color={colors.primary} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Open Banking sync</Text>
        <Text style={styles.subtitle}>Not connected — DESIGN ONLY, no backend integration exists</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: 1 },
  title: { fontSize: 12, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 11, color: colors.textMuted },
});
