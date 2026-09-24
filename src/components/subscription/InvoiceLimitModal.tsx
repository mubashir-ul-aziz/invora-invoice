import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { UsageMeter } from '@/components/subscription/UsageMeter';
import type { InvoiceUsage } from '@/domain/subscription/invoiceAccess';
import { describeUpgradeReason } from '@/domain/subscription/upgradeReason';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  visible: boolean;
  /** The plan's real, current usage reading (from `useSubscription().usage`) — never a hardcoded number. */
  usage: InvoiceUsage | null;
  planLabel: string;
  onUpgrade: () => void;
  onDismiss: () => void;
  testID?: string;
}

/**
 * The Kinetic Ledger "Invoice limit reached" modal — matches the Stitch
 * "Invoice Limit Reached Modal" design (bottom-sheet card, lock badge, usage
 * meter, primary upgrade CTA, a plain dismiss). Replaces the plain
 * `Alert.alert` this flow used previously.
 *
 * Every number shown comes from `usage` (itself `EntitlementService`'s real
 * reading via `useSubscription()`) — this component computes nothing and
 * duplicates no plan/limit rule.
 */
export function InvoiceLimitModal({ visible, usage, planLabel, onUpgrade, onDismiss, testID }: Props) {
  const copy = describeUpgradeReason('invoice_limit', { limit: usage?.limit });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} testID={testID ?? 'invoice-limit-modal'}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Dismiss" onPress={onDismiss} testID="invoice-limit-modal-backdrop" />
        <View style={styles.sheet}>
          <View style={styles.iconCircle}>
            <Feather name="lock" size={24} color={colors.primary} />
          </View>

          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.message}>{copy.message}</Text>

          <View style={styles.usageCard} testID="invoice-limit-modal-usage">
            <View style={styles.usageTopRow}>
              <Text style={styles.usagePlanLabel}>{planLabel} plan</Text>
              {usage && (
                <Text style={styles.usageCount}>
                  {usage.used}
                  {usage.limit !== null ? ` / ${usage.limit}` : ''}
                </Text>
              )}
            </View>
            <UsageMeter usage={usage} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View plans"
            testID="invoice-limit-modal-upgrade"
            onPress={onUpgrade}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Feather name="arrow-up-circle" size={16} color={colors.primaryText} />
            <Text style={styles.primaryButtonText}>View Plans</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            testID="invoice-limit-modal-dismiss"
            onPress={onDismiss}
            style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}
          >
            <Text style={styles.dismissText}>Not now</Text>
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
  message: { fontSize: typography.body.fontSize, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  usageCard: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  usageTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  usagePlanLabel: { fontSize: typography.caption.fontSize, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  usageCount: { fontSize: typography.h3.fontSize, fontWeight: typography.h3.weight, color: colors.text },
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
