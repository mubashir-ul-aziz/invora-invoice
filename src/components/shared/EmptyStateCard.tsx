import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { colors } from '@/theme/colors';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  message: string;
  /** Omit to render the card without a button (e.g. picker modes). */
  actionLabel?: string;
  actionIcon?: keyof typeof Feather.glyphMap;
  onAction?: () => void;
  /** `primary` for the screen's one create action; `secondary` for recovery actions like "Clear search". */
  actionVariant?: 'primary' | 'secondary';
  testID?: string;
  actionTestID?: string;
}

/**
 * The shared list empty state: a centered white card with an icon, a short
 * message and at most one button. Used for both "no records yet" and "no
 * search/filter matches", so every list screen's empty state looks the same.
 */
export function EmptyStateCard({
  icon,
  title,
  message,
  actionLabel,
  actionIcon,
  onAction,
  actionVariant = 'primary',
  testID,
  actionTestID,
}: Props) {
  return (
    <View style={styles.centered} testID={testID}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Feather name={icon} size={24} color={colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {!!actionLabel && !!onAction && (
          <View style={styles.action}>
            <ActionButton
              label={actionLabel}
              icon={actionIcon}
              variant={actionVariant}
              onPress={onAction}
              testID={actionTestID}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  message: { fontSize: 13, color: colors.textMuted, textAlign: 'center', maxWidth: 270 },
  action: { alignSelf: 'stretch', marginTop: 10 },
});
