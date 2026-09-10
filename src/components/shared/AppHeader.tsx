import { Feather } from '@expo/vector-icons';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

/** Content height, excluding the safe-area top inset — a compact, modern mobile header. */
export const HEADER_CONTENT_HEIGHT = 56;

/**
 * Single header used across every screen in the stack (wired in via
 * `screenOptions.header` on `RootNavigator`) so title placement, the back
 * arrow, and any right-side action stay visually consistent everywhere —
 * screens opt into a right-side icon via `options.headerRight`, same as
 * react-navigation's built-in header.
 */
export function AppHeader({ navigation, route, options, back }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const title = options.title ?? route.name;

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <View style={styles.side}>
          {!!back && (
            <Pressable
              onPress={navigation.goBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="header-back"
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            >
              <Feather name="chevron-left" size={24} color={colors.text} />
            </Pressable>
          )}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.side, styles.sideRight]}>
          {typeof options.headerRight === 'function'
            ? options.headerRight({ canGoBack: !!back, tintColor: colors.text })
            : null}
        </View>
      </View>
    </View>
  );
}

/** Compact round icon button for the header's right side (profile/business icon, overflow menu, …). */
export function HeaderIconButton({
  icon,
  onPress,
  label,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
    >
      <Feather name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  bar: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  side: { minWidth: 44, alignItems: 'flex-start', justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: { backgroundColor: colors.background },
});
