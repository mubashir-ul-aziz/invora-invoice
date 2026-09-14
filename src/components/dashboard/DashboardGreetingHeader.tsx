import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { BusinessProfile } from '@/domain/business/types';
import { colors } from '@/theme/colors';

interface Props {
  profile: BusinessProfile | null;
  testID?: string;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Top greeting block from the Stitch design. The business name and VAT/tax
 * id are real (`BusinessProfile.businessName`/`taxId`, from
 * `businessProfileStore`). The Stitch design also shows a "Live FY 2024-25"
 * badge and an "Updated 3m ago" timestamp — there is no fiscal-year setting
 * or last-sync timestamp anywhere in the schema, so both are rendered as
 * visible "DESIGN ONLY" placeholders rather than invented values. The
 * Stitch mock also greets a named person ("Alex"); this app has no
 * separate user/owner-name field (only a business profile), so the greeting
 * omits a fabricated name.
 */
export function DashboardGreetingHeader({ profile, testID }: Props) {
  const greeting = greetingForHour(new Date().getHours());

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.topRow}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>DESIGN ONLY</Text>
        </View>
        <Text style={styles.updatedText}>DESIGN ONLY</Text>
      </View>
      <Text style={styles.greeting}>{greeting}</Text>
      {!!profile?.businessName && (
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitleText} numberOfLines={1}>
            {profile.businessName}
          </Text>
          {!!profile.taxId && (
            <>
              <View style={styles.dot} />
              <Text style={styles.vatText} numberOfLines={1}>
                VAT {profile.taxId}
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0F9D58' },
  liveBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  updatedText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3, marginTop: 2 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  subtitleText: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  vatText: { fontSize: 12, color: colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.placeholder },
});
