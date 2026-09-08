import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { formatBackupSize } from '@/domain/cloudBackup/formatting';
import type { CloudStoragePlanId } from '@/domain/cloudBackup/types';
import { useCloudBackupStore } from '@/state/cloudBackupStore';
import { colors } from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'UpgradeStorage'>;

/**
 * "Upgrade storage" placeholder (Phase 12), per the explicit instruction to
 * keep subscription/payment modular and **not** build a billing system —
 * no backend for one exists yet (`MVP_BUILD_PLAN.md` §10). Plans come from
 * the static `CLOUD_STORAGE_PLANS` registry (via `cloudBackupStore`'s
 * `getUpgradePlans()`, never `data/container` directly — this screen, like
 * every other, depends only on its store); tapping "Upgrade" calls
 * `requestUpgrade()`, which today always reports "not available yet"
 * honestly (`PlaceholderCloudUpgradeService`) instead of faking a checkout
 * flow. Swapping in a real payment provider later is a one-class change
 * behind `CloudUpgradeService` — nothing here would need to change beyond
 * how the button's result is handled.
 */
export function UpgradeStorageScreen(_props: Props) {
  const { storageUsage, getUpgradePlans, requestUpgrade } = useCloudBackupStore();
  const [pendingPlanId, setPendingPlanId] = useState<CloudStoragePlanId | null>(null);
  const plans = getUpgradePlans();

  const handleUpgrade = async (planId: CloudStoragePlanId) => {
    setPendingPlanId(planId);
    try {
      const result = await requestUpgrade(planId);
      Alert.alert(result.status === 'success' ? 'Upgraded' : 'Not available yet', result.message);
    } finally {
      setPendingPlanId(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="upgrade-storage-screen">
      <Text style={styles.intro}>
        Choose a cloud backup storage plan. Upgrading isn't available yet — this screen is a placeholder for a
        future subscription.
      </Text>
      {plans.map((plan) => {
        const isCurrent = storageUsage?.planId === plan.id;
        return (
          <View key={plan.id} style={[styles.card, isCurrent && styles.cardCurrent]} testID={`plan-${plan.id}`}>
            <View style={styles.cardHeader}>
              <Text style={styles.planLabel}>{plan.label}</Text>
              {isCurrent && <Text style={styles.currentBadge}>Current plan</Text>}
            </View>
            <Text style={styles.planLimit}>{formatBackupSize(plan.limitBytes)} of cloud storage</Text>
            <Text style={styles.planPrice}>{plan.priceLabel}</Text>
            {plan.isUpgradeTarget && (
              <ActionButton
                label={pendingPlanId === plan.id ? 'Checking…' : `Upgrade to ${plan.label}`}
                variant="primary"
                onPress={() => handleUpgrade(plan.id)}
                disabled={pendingPlanId !== null}
                testID={`upgrade-${plan.id}`}
              />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  intro: { fontSize: 13, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardCurrent: { borderColor: colors.primary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  currentBadge: { fontSize: 11, fontWeight: '700', color: colors.primary },
  planLimit: { fontSize: 13, color: colors.text },
  planPrice: { fontSize: 12, color: colors.textMuted },
});
