import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface TabSpec {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  testID: string;
  active?: boolean;
}

interface Props {
  onInvoices: () => void;
  onCustomers: () => void;
  onBusiness: () => void;
  onSettings: () => void;
}

/**
 * The Stitch design's bottom tab bar (Dashboard / Invoices / Customers /
 * Business). Local to this screen only — the app's real navigation shell is
 * `RootNavigator`'s stack, so this doesn't replace it or affect any other
 * screen, it just gives Dashboard the same quick-switch affordance the
 * Stitch mock shows, using routes that already exist.
 *
 * The Stitch mock's nav only has 4 tabs; a 5th "Settings" tab is kept here
 * so the previously-existing "jump to Settings" action (covered by
 * `DashboardScreen.test.tsx`) stays reachable.
 */
export function DashboardBottomNav({ onInvoices, onCustomers, onBusiness, onSettings }: Props) {
  const tabs: TabSpec[] = [
    { label: 'Dashboard', icon: 'grid', onPress: () => {}, testID: 'nav-dashboard', active: true },
    { label: 'Invoices', icon: 'file-text', onPress: onInvoices, testID: 'action-invoices' },
    { label: 'Customers', icon: 'users', onPress: onCustomers, testID: 'action-customers' },
    { label: 'Business', icon: 'briefcase', onPress: onBusiness, testID: 'action-business' },
    { label: 'Settings', icon: 'settings', onPress: onSettings, testID: 'action-settings' },
  ];

  return (
    <View style={styles.bar}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.testID}
          accessibilityRole="button"
          accessibilityLabel={tab.label}
          testID={tab.testID}
          onPress={tab.onPress}
          disabled={tab.active}
          style={styles.tab}
        >
          <Feather name={tab.icon} size={20} color={tab.active ? colors.primary : colors.textMuted} />
          <Text style={[styles.label, tab.active && styles.labelActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  labelActive: { color: colors.primary },
});
