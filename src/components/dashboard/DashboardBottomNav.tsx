import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

type TabKey = 'dashboard' | 'invoices' | 'customers' | 'business' | 'settings';

interface TabSpec {
  key: TabKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  testID: string;
}

interface Props {
  /** Which tab is highlighted (and disabled) as the current screen. Defaults to 'dashboard' — the Dashboard screen's original, only caller. */
  activeTab?: TabKey;
  onDashboard?: () => void;
  onInvoices?: () => void;
  onCustomers?: () => void;
  onBusiness?: () => void;
  onSettings?: () => void;
}

/**
 * The Stitch design's bottom tab bar (Dashboard / Invoices / Customers /
 * Business), shared by every screen that reproduces it — Local to the
 * screens that render it, not the app's real navigation shell
 * (`RootNavigator`'s stack), so it doesn't replace that or affect any screen
 * that doesn't opt in; it just gives each screen the same quick-switch
 * affordance the Stitch mocks show, using routes that already exist.
 *
 * The Stitch mocks' nav only has 4 tabs; a 5th "Settings" tab is kept here so
 * the previously-existing "jump to Settings" action (covered by
 * `DashboardScreen.test.tsx`) stays reachable from Dashboard.
 */
export function DashboardBottomNav({
  activeTab = 'dashboard',
  onDashboard,
  onInvoices,
  onCustomers,
  onBusiness,
  onSettings,
}: Props) {
  const tabs: TabSpec[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'grid', onPress: onDashboard, testID: 'nav-dashboard' },
    { key: 'invoices', label: 'Invoices', icon: 'file-text', onPress: onInvoices, testID: 'action-invoices' },
    { key: 'customers', label: 'Customers', icon: 'users', onPress: onCustomers, testID: 'action-customers' },
    { key: 'business', label: 'Business', icon: 'briefcase', onPress: onBusiness, testID: 'action-business' },
    { key: 'settings', label: 'Settings', icon: 'settings', onPress: onSettings, testID: 'action-settings' },
  ];

  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Pressable
            key={tab.testID}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            testID={tab.testID}
            onPress={tab.onPress ?? (() => {})}
            disabled={active}
            style={styles.tab}
          >
            <Feather name={tab.icon} size={20} color={active ? colors.primary : colors.textMuted} />
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
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
