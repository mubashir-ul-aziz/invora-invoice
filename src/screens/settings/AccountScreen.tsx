import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { getCloudStoragePlan } from '@/domain/cloudBackup/types';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessProfileStore } from '@/state/businessProfileStore';
import { useCloudBackupStore } from '@/state/cloudBackupStore';
import { useSubscription } from '@/state/useSubscription';
import { restoreOutcomeMessage } from '@/screens/subscription/outcomeMessages';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

/**
 * Account / Subscription (Phase 10 placeholder, now backed by the real
 * subscription layer). Metriqo has no cloud account or login system —
 * everything runs off the on-device database (`MVP_BUILD_PLAN.md` §4) — so
 * this screen still says so honestly instead of faking a sign-in/sign-out
 * flow. "Logout" is listed by the brief but has nothing to log out of; it's a
 * labelled, working button that says so rather than a dead link.
 *
 * The Subscription card now shows the user's real Metriqo plan (RevenueCat +
 * Google Play, via `useSubscription()`) with a link to the Pricing screen,
 * and "Restore Purchases" runs a real restore. The separate Cloud Backup
 * storage plan (`cloudBackupStore`, `UpgradeStorage`) is an unrelated,
 * still-placeholder add-on and keeps its own promo card. The identity header
 * uses the real business profile rather than Stitch's invented personal
 * user; the Account Credentials rows (email / member-since / billing
 * reference) have no real analog — there is no account system — and remain
 * marked DESIGN ONLY with honest "not applicable" values, never invented ones.
 */
export function AccountScreen({ navigation }: Props) {
  const { profile, load: loadProfile } = useBusinessProfileStore();
  const { settings: cloudSettings, load: loadCloudBackup } = useCloudBackupStore();
  const subscription = useSubscription();

  useEffect(() => {
    loadProfile();
    loadCloudBackup();
  }, [loadProfile, loadCloudBackup]);

  const currentPlan = getCloudStoragePlan(cloudSettings.planId ?? 'free');
  const plusPlan = getCloudStoragePlan('plus');
  const handleRestore = async () => {
    const message = restoreOutcomeMessage(await subscription.restore());
    Alert.alert(message.title, message.message);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="account-screen">
      {/* Real business identity header — replaces Stitch's fake personal user identity */}
      <View style={styles.identityCard}>
        {profile?.logoUri ? (
          <Image source={{ uri: profile.logoUri }} style={styles.identityLogo} />
        ) : (
          <View style={styles.identityLogoPlaceholder}>
            <Text style={styles.identityLogoPlaceholderText}>
              {(profile?.businessName?.trim() || 'Y').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.flexShrink}>
          <Text style={styles.identityName} numberOfLines={1}>
            {profile?.businessName?.trim() || 'Your business'}
          </Text>
          <Text style={styles.identityCaption}>All data stored locally on this device</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={styles.title}>Account</Text>
        </View>
        <Text style={styles.body}>
          Metriqo runs fully offline, with your data stored on this device. There's no cloud
          account to sign in to yet.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Feather name="star" size={16} color={colors.primary} />
          <Text style={styles.title}>Subscription</Text>
          <View style={styles.planPill} testID="account-plan-pill">
            <Text style={styles.planPillText}>{subscription.planConfig.label} plan</Text>
          </View>
        </View>
        <Text style={styles.body}>
          Your plan sets how many invoices you can create each month and whether you can open older invoices and customer
          history. Your data always stays saved on this device. Cloud backup storage is a separate, optional add-on.
        </Text>
        <ActionButton
          label="Plans & subscription"
          icon="star"
          variant="primary"
          onPress={() => navigation.navigate('Pricing')}
          testID="account-view-plans"
        />
      </View>

      {/* Real promo — navigates to the actual UpgradeStorage screen, using the real Plus plan (no invented price) */}
      {currentPlan.id !== plusPlan.id && (
        <View style={styles.promoCard}>
          <View style={styles.promoBadge}>
            <Feather name="zap" size={12} color={colors.primaryText} />
            <Text style={styles.promoBadgeText}>MORE CLOUD STORAGE</Text>
          </View>
          <Text style={styles.promoTitle}>Metriqo {plusPlan.label}</Text>
          <Text style={styles.promoPrice}>{plusPlan.priceLabel}</Text>
          <Text style={styles.promoBody}>Upgrade your cloud backup plan for more storage room.</Text>
          <ActionButton
            label={`Upgrade to ${plusPlan.label}`}
            icon="arrow-up-circle"
            variant="primary"
            onPress={() => navigation.navigate('UpgradeStorage')}
            testID="account-upgrade"
          />
        </View>
      )}

      {/* Credentials rows are DESIGN ONLY: there is no account/login system, so values are honest placeholders, never invented facts. Restore Purchases below is real (RevenueCat + Google Play). */}
      <View style={styles.card}>
        <Text style={styles.title}>Account Credentials · DESIGN ONLY</Text>
        <CredentialRow icon="at-sign" label="Account Email" value="Not applicable — no sign-in required" />
        <CredentialRow icon="calendar" label="Member Since" value="Not tracked" />
        <CredentialRow icon="hash" label="Billing Reference" value="Not applicable" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          testID="action-restore-purchases"
          onPress={handleRestore}
          style={({ pressed }) => [styles.restoreRow, pressed && styles.pressed]}
        >
          <View style={styles.restoreIcon}>
            <Feather name="rotate-ccw" size={17} color={colors.primary} />
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.restoreLabel}>Restore Purchases</Text>
            <Text style={styles.restoreCaption}>Check your store account for an active Metriqo subscription</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <ActionButton
        label="Log out"
        onPress={() =>
          Alert.alert(
            "You're not signed in",
            'There is no account to log out of yet — all your data stays on this device either way.',
          )
        }
        testID="action-logout"
      />
    </ScrollView>
  );
}

function CredentialRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.credentialRow}>
      <View style={styles.credentialLabelRow}>
        <Feather name={icon} size={15} color={colors.textMuted} />
        <Text style={styles.credentialLabel}>{label}</Text>
      </View>
      <Text style={styles.credentialValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  pressed: { opacity: 0.75 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  identityLogo: { width: 44, height: 44, borderRadius: 11, backgroundColor: colors.background },
  identityLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityLogoPlaceholderText: { color: colors.primaryText, fontSize: 17, fontWeight: '700' },
  identityName: { fontSize: 15, fontWeight: '700', color: colors.text },
  identityCaption: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  body: { fontSize: 13, color: colors.textMuted },

  planPill: { backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  planPillText: { fontSize: 11, fontWeight: '700', color: colors.text },

  promoCard: {
    backgroundColor: colors.text,
    borderRadius: 16,
    padding: 18,
    gap: 6,
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  promoBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primaryText, letterSpacing: 0.4 },
  promoTitle: { fontSize: 19, fontWeight: '700', color: colors.surface },
  promoPrice: { fontSize: 13, fontWeight: '600', color: colors.placeholder },
  promoBody: { fontSize: 12, color: colors.placeholder, marginBottom: 8 },

  credentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 10,
  },
  credentialLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  credentialLabel: { fontSize: 12, color: colors.textMuted },
  credentialValue: { fontSize: 12, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },

  restoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.background },
  restoreIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  restoreLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  restoreCaption: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
});
