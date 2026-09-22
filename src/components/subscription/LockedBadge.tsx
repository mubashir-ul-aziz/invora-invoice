import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  label?: string;
  testID?: string;
}

/**
 * A small "Locked" pill for list rows whose content needs a paid plan. Purely
 * presentational — whether something is locked is decided by
 * `useSubscription()`, never here.
 */
export function LockedBadge({ label = 'Locked', testID }: Props) {
  return (
    <View style={styles.pill} testID={testID} accessibilityLabel={`${label} — upgrade to open`}>
      <Feather name="lock" size={10} color={colors.textMuted} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
});
