import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { describeUpgradeReason } from '@/domain/subscription/upgradeReason';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  visible: boolean;
  /** The customer's name, shown for context only — never balances/contact details. */
  customerName?: string | null;
  onUpgrade: () => void;
  onDismiss: () => void;
  testID?: string;
}

/**
 * The Kinetic Ledger "Customer history locked" modal — matches the Stitch
 * "Customer Locked Modal" design. Used as the *first* line of feedback when a
 * Free user taps into a customer's History (intercepted before navigation, so
 * they never land on an empty/locked full screen) — see
 * `CustomerDetailScreen`'s history action.
 *
 * `withCustomerHistoryGuard` (`navigation/guards.tsx`) remains the safety net
 * for direct navigation into `CustomerHistory` (e.g. a stale deep link); this
 * modal does not replace it, it only makes the common tap-through path nicer.
 * Neither one locks the customer record itself — creating/editing/picking a
 * customer is never restricted (see `canAccessHistoricalCustomer()`).
 */
export function CustomerLockedModal({ visible, customerName, onUpgrade, onDismiss, testID }: Props) {
  const copy = describeUpgradeReason('locked_customer');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} testID={testID ?? 'customer-locked-modal'}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Dismiss" onPress={onDismiss} testID="customer-locked-modal-backdrop" />
        <View style={styles.sheet}>
          <View style={styles.iconCircle}>
            <Feather name="lock" size={24} color={colors.primary} />
          </View>

          <Text style={styles.title}>{copy.title}</Text>
          {!!customerName && (
            <Text style={styles.customerName} numberOfLines={1}>
              {customerName}
            </Text>
          )}
          <Text style={styles.message}>{copy.message}</Text>

          <View style={styles.reassureRow}>
            <Feather name="check-circle" size={14} color={colors.success} />
            <Text style={styles.reassureText}>Basic customer info stays available — nothing is locked or removed.</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View plans"
            testID="customer-locked-modal-upgrade"
            onPress={onUpgrade}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Feather name="arrow-up-circle" size={16} color={colors.primaryText} />
            <Text style={styles.primaryButtonText}>View Plans</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            testID="customer-locked-modal-dismiss"
            onPress={onDismiss}
            style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: typography.h2.fontSize, fontWeight: typography.h2.weight, color: colors.text, textAlign: 'center' },
  customerName: { fontSize: typography.bodyBold.fontSize, fontWeight: '700', color: colors.textMuted },
  message: { fontSize: typography.body.fontSize, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  reassureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
  },
  reassureText: { flex: 1, fontSize: typography.caption.fontSize, color: colors.success, lineHeight: 16 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryButtonText: { fontSize: typography.bodyBold.fontSize, fontWeight: '700', color: colors.primaryText },
  dismissButton: { width: '100%', height: 40, alignItems: 'center', justifyContent: 'center' },
  dismissText: { fontSize: typography.body.fontSize, fontWeight: '600', color: colors.textMuted },
  pressed: { opacity: 0.8 },
});
