import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { describeUpgradeReason, type UpgradeReason } from '@/domain/subscription/upgradeReason';
import { colors } from '@/theme/colors';

interface Props {
  reason: UpgradeReason;
  /** Non-sensitive identifying lines (e.g. an invoice number and its creation date) shown above the lock message. */
  details?: string[];
  onUpgrade: () => void;
  onBack: () => void;
  testID?: string;
}

/**
 * The upgrade prompt shown in place of locked content (a historical invoice,
 * customer history). It deliberately shows only identifying metadata — never
 * amounts, line items or contact details. Nothing is deleted or hidden in the
 * database; this is an access screen only, and it goes away the moment the
 * user has a plan that includes the content.
 */
export function LockedContentView({ reason, details, onUpgrade, onBack, testID }: Props) {
  const copy = describeUpgradeReason(reason);
  return (
    <View style={styles.screen} testID={testID ?? 'locked-content'}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Feather name="lock" size={26} color={colors.primary} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        {!!details?.length && (
          <View style={styles.details}>
            {details.map((line) => (
              <Text key={line} style={styles.detailLine}>
                {line}
              </Text>
            ))}
          </View>
        )}
        <Text style={styles.message}>{copy.message}</Text>
        <ActionButton label="View plans" variant="primary" icon="arrow-up-circle" onPress={onUpgrade} testID="locked-view-plans" />
        <ActionButton label="Go back" variant="text" onPress={onBack} testID="locked-go-back" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: colors.background },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  details: { alignItems: 'center', gap: 2 },
  detailLine: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  message: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
});
