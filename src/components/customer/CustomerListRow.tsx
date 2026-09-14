import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CustomerBalanceStatus } from '@/domain/customer/activity';
import type { Customer, CustomerBalanceSummary } from '@/domain/customer/types';
import { colors } from '@/theme/colors';

interface Props {
  customer: Customer;
  /** Undefined while the balance for this row hasn't loaded yet (see `customerBalancesStore`) — renders a quiet placeholder instead of a wrong number. */
  balance?: CustomerBalanceSummary;
  balanceStatus?: CustomerBalanceStatus;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  testID?: string;
}

/** Cycles through a small set of avatar tints, matching the Stitch mock's varied initials-circle colors — picked deterministically from the customer id so a given customer always gets the same one. */
const AVATAR_STYLES: { background: string; foreground: string }[] = [
  { background: '#D3E4FE', foreground: colors.primary },
  { background: '#DAE2FD', foreground: '#3F465C' },
  { background: '#DCE9FF', foreground: '#003EA8' },
  { background: '#DBFCEC', foreground: '#006243' },
  { background: '#E5EEFF', foreground: colors.text },
];

/** Exported so Customer Detail's profile header can reuse the exact same per-customer avatar tint. */
export function avatarStyleFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
}

/** Exported so Customer Detail's profile header can reuse the exact same initials rule. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}

const STATUS_BADGE: Record<CustomerBalanceStatus, { label: string; bg: string; fg: string; icon?: keyof typeof Feather.glyphMap }> = {
  settled: { label: 'Settled', bg: colors.background, fg: colors.textMuted, icon: 'check-circle' },
  due: { label: 'Due', bg: '#FBE4E2', fg: colors.danger },
  overdue: { label: 'Overdue', bg: '#FBE4E2', fg: colors.danger },
};

/** One row on the Customer List screen: avatar, name, phone/email, real outstanding balance + status, and edit/delete actions. */
export function CustomerListRow({ customer, balance, balanceStatus, onPress, onEdit, onDelete, testID }: Props) {
  // The Stitch mock's second row detail is sometimes a business-category tag
  // ("Commercial Realty") and sometimes an email — there's no category/tag
  // field on `Customer` (see domain/customer/types.ts), so this always uses
  // the real phone/email fields, matching the mock's own email-detail rows.
  const subtitleParts = [customer.phone, customer.email].filter(Boolean);
  const avatarStyle = avatarStyleFor(customer.id);
  const badge = balanceStatus ? STATUS_BADGE[balanceStatus] : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${customer.name}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.avatar, { backgroundColor: avatarStyle.background }]}>
        <Text style={[styles.avatarText, { color: avatarStyle.foreground }]}>{initialsFor(customer.name)}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {customer.name}
        </Text>
        {subtitleParts.length > 0 && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </Text>
        )}
      </View>

      <View style={styles.balanceBlock}>
        {balance ? (
          <>
            <Text style={[styles.amount, balance.outstanding > 0 && styles.amountDue]}>
              {formatAmount(balance.outstanding)}
            </Text>
            {!!badge && (
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                {badge.icon && <Feather name={badge.icon} size={10} color={badge.fg} />}
                <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.amountPlaceholder}>—</Text>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${customer.name}`}
          testID={testID ? `${testID}-edit` : undefined}
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Feather name="edit-2" size={15} color={colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${customer.name}`}
          testID={testID ? `${testID}-delete` : undefined}
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Feather name="trash-2" size={15} color={colors.danger} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressed: { opacity: 0.7 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 15, fontWeight: '700' },
  info: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted },
  balanceBlock: { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  amount: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  amountDue: { color: colors.danger },
  amountPlaceholder: { fontSize: 15, color: colors.placeholder },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'column', gap: 2, flexShrink: 0, paddingLeft: 2 },
  actionButton: { padding: 6, borderRadius: 8 },
});
