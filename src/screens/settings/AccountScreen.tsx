import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

/**
 * Account / Subscription placeholder (Phase 10), per the explicit
 * "RELATED SCREENS: Account/Subscription placeholder" and "do not implement
 * unnecessary account features" / "do not implement payment processing"
 * instructions. Invora has no cloud account or login system yet — everything
 * runs off the on-device database (`MVP_BUILD_PLAN.md` §4) — so this screen
 * states that honestly instead of faking a sign-in/sign-out flow or a
 * checkout. "Logout" is listed by the brief but has nothing to log out of
 * today; it's a labelled, working button that says so rather than a dead
 * link, so tapping it is never a silent no-op.
 */
export function AccountScreen(_props: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="account-screen">
      <View style={styles.card}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.body}>
          Invora runs fully offline, with your data stored on this device. There's no cloud
          account to sign in to yet.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Subscription</Text>
        <Text style={styles.body}>
          Invora is free to use today. An optional, paid cloud backup plan is available — see Cloud Backup in
          Settings. Upgrading storage isn't available yet; see the Cloud Backup screen for details.
        </Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.textMuted },
});
