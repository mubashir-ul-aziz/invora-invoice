import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { formatBackupSize, formatStorageUsage, storageUsageRatio } from '@/domain/cloudBackup/formatting';
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
 *
 * Restyled to match the Stitch "Upgrade Storage" design's gauge + plan-card
 * layout. Stitch invents three priced tiers (£2.99/£5.99/£12.99, 25/100/
 * 500 GB) with per-plan feature lists (rollback history, WhatsApp recovery,
 * HMRC/IRS archiving, an uptime SLA) and a monthly/annual billing toggle —
 * none of that exists: the real registry has exactly two plans (Free 250 MB,
 * Plus 5 GB) with a single non-numeric `priceLabel` ("Coming soon"), no
 * feature differences beyond storage size, and no billing-cycle concept.
 * Showing invented prices/tiers here would misrepresent a real cost, so
 * this screen keeps rendering the real plan registry (unchanged loop/
 * testIDs) restyled to match the card aesthetic, instead of reproducing
 * Stitch's fabricated tiers. The usage gauge is real (`storageUsage`). The
 * one verified-true trust badge from `CloudBackupScreen` (AES-256-GCM) is
 * kept; Stitch's GDPR/CCPA/uptime-SLA claims (no backend is deployed to
 * verify them against) are dropped. "Restore Purchases" is DESIGN ONLY, no
 * IAP integration exists anywhere in this app.
 */
export function UpgradeStorageScreen(_props: Props) {
  const { storageUsage, load, getUpgradePlans, requestUpgrade } = useCloudBackupStore();
  const [pendingPlanId, setPendingPlanId] = useState<CloudStoragePlanId | null>(null);
  const plans = getUpgradePlans();

  useEffect(() => {
    load();
  }, [load]);

  const handleUpgrade = async (planId: CloudStoragePlanId) => {
    setPendingPlanId(planId);
    try {
      const result = await requestUpgrade(planId);
      Alert.alert(result.status === 'success' ? 'Upgraded' : 'Not available yet', result.message);
    } finally {
      setPendingPlanId(null);
    }
  };

  const notAvailable = (what: string) => Alert.alert('Not available', `${what} is not implemented yet.`);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="upgrade-storage-screen">
      <Text style={styles.heading}>Upgrade Cloud Storage</Text>
      <Text style={styles.intro}>
        Choose a cloud backup storage plan. Upgrading isn't available yet — this screen is a placeholder for a
        future subscription.
      </Text>

      {/* Real usage gauge */}
      {storageUsage && (
        <View style={styles.gaugeCard}>
          <View style={styles.gaugeTop}>
            <View style={styles.gaugeLabelRow}>
              <Feather name="cloud" size={16} color={colors.primary} />
              <Text style={styles.gaugeLabel}>{formatStorageUsage(storageUsage)}</Text>
            </View>
          </View>
          <View style={styles.gaugeTrack}>
            <View style={[styles.gaugeFill, { width: `${storageUsageRatio(storageUsage) * 100}%` }]} />
          </View>
          <Text style={styles.gaugeHint}>{formatBackupSize(storageUsage.limitBytes - storageUsage.usedBytes)} remaining</Text>
        </View>
      )}

      {plans.map((plan) => {
        const isCurrent = storageUsage?.planId === plan.id;
        return (
          <View key={plan.id} style={[styles.card, isCurrent && styles.cardCurrent]} testID={`plan-${plan.id}`}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Feather name={plan.isUpgradeTarget ? 'zap' : 'archive'} size={18} color={colors.primary} />
              </View>
              <View style={styles.flexShrink}>
                <Text style={styles.planLabel}>{plan.label}</Text>
                {isCurrent && <Text style={styles.currentBadge}>Current plan</Text>}
              </View>
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

      <View style={styles.trustCard}>
        <View style={styles.trustHeader}>
          <Feather name="shield" size={16} color={colors.text} />
          <Text style={styles.trustTitle}>Security</Text>
        </View>
        <View style={styles.trustRow}>
          <Feather name="lock" size={13} color={colors.primary} />
          <Text style={styles.trustText}>Backups encrypted with AES-256-GCM before upload</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Restore purchases — DESIGN ONLY, not implemented"
        testID="action-restore-purchases-design-only"
        onPress={() => notAvailable('Restoring purchases')}
        style={({ pressed }) => [styles.restoreLink, pressed && styles.pressed]}
      >
        <Feather name="rotate-ccw" size={15} color={colors.primary} />
        <Text style={styles.restoreLinkText}>Restore Purchases · DESIGN ONLY</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  intro: { fontSize: 13, color: colors.textMuted },

  gaugeCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  gaugeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gaugeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gaugeLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  gaugeTrack: { height: 8, borderRadius: 4, backgroundColor: colors.background, overflow: 'hidden' },
  gaugeFill: { height: '100%', backgroundColor: colors.primary },
  gaugeHint: { fontSize: 11, color: colors.textMuted },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardCurrent: { borderColor: colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  planLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  currentBadge: { fontSize: 11, fontWeight: '700', color: colors.primary, marginTop: 1 },
  planLimit: { fontSize: 13, color: colors.text },
  planPrice: { fontSize: 12, color: colors.textMuted },

  trustCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  trustHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },

  restoreLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  restoreLinkText: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
