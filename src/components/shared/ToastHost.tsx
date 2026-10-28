import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore, type ToastType } from '@/state/toastStore';
import { colors, radius, spacing, typography } from '@/theme/colors';

export const TOAST_SLIDE_MS = 400;
export const TOAST_VISIBLE_MS = 3000;
/** CSS `ease-in-out`. */
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
/** Used to park the toast above the screen until its real height is measured. */
const FALLBACK_HEIGHT = 120;

const TYPE_STYLES: Record<ToastType, { icon: keyof typeof Feather.glyphMap; iconColor: string; iconBg: string; text: string }> = {
  success: { icon: 'check-circle', iconColor: colors.success, iconBg: colors.successBg, text: colors.text },
  error: { icon: 'alert-circle', iconColor: colors.danger, iconBg: colors.dangerBg, text: colors.danger },
  info: { icon: 'info', iconColor: colors.primary, iconBg: colors.primarySurface, text: colors.text },
};

/**
 * Renders `useToastStore`'s current toast: slides down from the top over
 * 0.4s (ease-in-out), stays 3s, then slides back up the same way. Mounted
 * once at the app root, above the navigator. It has no backdrop and lets
 * every touch through (`pointerEvents="none"`), so the app stays fully
 * interactive while a toast is showing. A replacement toast arriving
 * mid-animation continues from wherever the current one is and restarts the
 * 3s hold.
 */
export function ToastHost() {
  const current = useToastStore((state) => state.current);
  const dismiss = useToastStore((state) => state.dismiss);
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [cardHeight, setCardHeight] = useState(FALLBACK_HEIGHT);

  const currentId = current?.id;
  useEffect(() => {
    if (currentId === undefined) {
      return;
    }
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    const useNativeDriver = Platform.OS !== 'web';
    progress.stopAnimation((value) => {
      if (cancelled) {
        return;
      }
      animation = Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: TOAST_SLIDE_MS * (1 - value),
          easing: EASE_IN_OUT,
          useNativeDriver,
        }),
        Animated.delay(TOAST_VISIBLE_MS),
        Animated.timing(progress, { toValue: 0, duration: TOAST_SLIDE_MS, easing: EASE_IN_OUT, useNativeDriver }),
      ]);
      animation.start(({ finished }) => {
        if (finished) {
          dismiss(currentId);
        }
      });
    });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [currentId, dismiss, progress]);

  useEffect(() => {
    if (current) {
      AccessibilityInfo.announceForAccessibility(current.title ? `${current.title}. ${current.message}` : current.message);
    }
  }, [current]);

  if (!current) {
    return null;
  }

  const typeStyle = TYPE_STYLES[current.type];
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-(cardHeight + insets.top + spacing.xl), 0],
  });

  return (
    <View pointerEvents="none" style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="toast-container">
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
        style={[styles.card, { transform: [{ translateY }] }]}
        testID={`toast-${current.type}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: typeStyle.iconBg }]}>
          <Feather name={typeStyle.icon} size={18} color={typeStyle.iconColor} />
        </View>
        <View style={styles.textWrap}>
          {current.title ? (
            <Text style={[styles.title, { color: typeStyle.text }]} testID="toast-title">
              {current.title}
            </Text>
          ) : null}
          <Text style={[styles.message, { color: typeStyle.text }]} testID="toast-message">
            {current.message}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: typography.bodyBold.fontSize,
    lineHeight: typography.bodyBold.lineHeight,
    fontWeight: typography.bodyBold.weight,
  },
  message: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.body.weight,
  },
});
