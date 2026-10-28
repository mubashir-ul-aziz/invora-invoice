import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

import { isTabBarHiddenFor, MAIN_TABS } from './tabs';

/** Android resizes the window for the keyboard, which would lift the bar above it; hide it while typing instead. */
function useAndroidKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * The app's single bottom navigation bar (Dashboard / Invoices / Customers /
 * Settings), rendered once by the tab navigator in `RootNavigator` below every
 * screen — screens never render it themselves. The bar sits below the screen
 * rather than over it, so lists, floating buttons and sticky footers end above
 * it without any per-screen padding; it also owns the bottom safe-area inset.
 *
 * Hidden during focused flows (see `isTabBarHiddenFor`); a spacer still keeps
 * those screens' sticky buttons clear of the system navigation bar / home
 * indicator.
 */
export function MainTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const keyboardVisible = useAndroidKeyboardVisible();
  const focusedTab = state.routes[state.index];
  const stack = focusedTab.state;
  // The nested stack has no state until it first renders — that's its root screen, which always shows the bar.
  const focusedScreen = stack?.routes[stack.index ?? stack.routes.length - 1];
  const hidden = keyboardVisible || (!!focusedScreen && isTabBarHiddenFor(focusedScreen));

  if (hidden) {
    return <View style={[styles.spacer, { height: keyboardVisible ? 0 : insets.bottom }]} testID="main-tab-bar-hidden" />;
  }

  return (
    <View style={[styles.bar, { paddingBottom: 8 + insets.bottom }]} testID="main-tab-bar">
      {MAIN_TABS.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.route);
        if (!route) {
          return null;
        }
        const active = route.key === focusedTab.key;

        const onPress = () => {
          // Lets the tab's stack pop back to its root when its already-active tab is tapped again.
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) {
            navigation.dispatch({ ...CommonActions.navigate(route.name, route.params), target: state.key });
          }
        };

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            testID={tab.testID}
            onPress={onPress}
            style={styles.tab}
          >
            <Feather name={tab.icon} size={20} color={active ? colors.primary : colors.textMuted} />
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  spacer: { backgroundColor: colors.background },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  labelActive: { color: colors.primary },
});
