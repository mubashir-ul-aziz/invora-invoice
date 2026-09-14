import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface ActionSpec {
  label: string;
  sublabel: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  testID: string;
  primary?: boolean;
}

interface Props {
  onCreateInvoice: () => void;
  onAddCustomer: () => void;
  onRecordPayment: () => void;
}

/** The Stitch design's 3-tile quick-actions row (New Invoice / Add Client / Log Pay). All three navigate using existing routes — same handlers `DashboardScreen` already wired up. */
export function DashboardQuickActions({ onCreateInvoice, onAddCustomer, onRecordPayment }: Props) {
  const actions: ActionSpec[] = [
    {
      label: 'New Invoice',
      sublabel: 'Fast draft',
      icon: 'plus',
      onPress: onCreateInvoice,
      testID: 'action-create-invoice',
      primary: true,
    },
    {
      label: 'Add Client',
      sublabel: 'Directory',
      icon: 'user-plus',
      onPress: onAddCustomer,
      testID: 'action-add-customer',
    },
    {
      label: 'Log Pay',
      sublabel: 'Record payment',
      icon: 'dollar-sign',
      onPress: onRecordPayment,
      testID: 'action-record-payment',
    },
  ];

  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.testID}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          testID={action.testID}
          onPress={action.onPress}
          style={({ pressed }) => [styles.tile, action.primary && styles.tilePrimary, pressed && styles.pressed]}
        >
          <View style={[styles.iconBox, action.primary && styles.iconBoxPrimary]}>
            <Feather name={action.icon} size={18} color={action.primary ? colors.primaryText : colors.primary} />
          </View>
          <Text style={[styles.label, action.primary && styles.labelPrimary]} numberOfLines={1}>
            {action.label}
          </Text>
          <Text style={[styles.sublabel, action.primary && styles.sublabelPrimary]} numberOfLines={1}>
            {action.sublabel}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tilePrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconBoxPrimary: { backgroundColor: 'rgba(255,255,255,0.18)' },
  label: { fontSize: 12, fontWeight: '700', color: colors.text },
  labelPrimary: { color: colors.primaryText },
  sublabel: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  sublabelPrimary: { color: 'rgba(255,255,255,0.8)' },
});
