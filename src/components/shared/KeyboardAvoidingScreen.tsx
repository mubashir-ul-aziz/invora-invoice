import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

type Props = ScrollViewProps & {
  children: React.ReactNode;
  /**
   * Fixed content below the scrolling area — the screen's `BottomActionBar`.
   * It never scrolls, never covers the content (the scroll area ends above
   * it), and is lifted above the keyboard together with the focused input.
   */
  footer?: React.ReactNode;
};

/**
 * Scrollable form screen that keeps the focused input and the action bar
 * below it clear of the on-screen keyboard, sliding them up when the keyboard
 * opens and back down when it closes.
 *
 * Every screen that pairs a form with a save/action button (CreateCustomerScreen,
 * EditItemScreen, RecordPaymentScreen, etc.) renders this instead of a bare
 * `ScrollView` — same props, plus `footer` for the fixed action bar. `style`
 * goes on the outer container (screen background/flex); everything else
 * (`contentContainerStyle`, `testID`, …) passes through to the inner
 * `ScrollView`.
 */
export function KeyboardAvoidingScreen({
  children,
  style,
  footer,
  keyboardShouldPersistTaps = 'handled',
  ...scrollViewProps
}: Props) {
  const containerRef = useRef<View>(null);
  // RN's KeyboardAvoidingView compares its parent-relative frame against the
  // keyboard's on-screen position, so on iOS it needs this view's distance
  // from the top of the window (the stack header, any step bar above it) as
  // its offset — otherwise it under-lifts by that much and the action bar ends
  // up behind the keyboard. Android resizes the window instead.
  const [windowTop, setWindowTop] = useState(0);
  const measureWindowTop = () => {
    if (Platform.OS !== 'ios') {
      return;
    }
    containerRef.current?.measureInWindow((_x, y) => {
      if (Number.isFinite(y)) {
        setWindowTop(y);
      }
    });
  };

  return (
    <View ref={containerRef} style={[styles.flex, style]} onLayout={measureWindowTop}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={windowTop}
      >
        <ScrollView style={styles.flex} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...scrollViewProps}>
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
