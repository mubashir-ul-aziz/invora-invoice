import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';

type Props = ScrollViewProps & {
  children: React.ReactNode;
};

/**
 * Scrollable form screen that keeps the focused input and the action
 * button(s) below it clear of the on-screen keyboard, sliding them up when
 * the keyboard opens and back down when it closes.
 *
 * Every screen that pairs a form with a save/action button inside a
 * `ScrollView` (CreateCustomerScreen, EditItemScreen, RecordPaymentScreen,
 * etc.) renders this instead of a bare `ScrollView` — same props, so it's a
 * drop-in swap. `style` goes on the outer `KeyboardAvoidingView` (screen
 * background/flex); everything else (`contentContainerStyle`, `testID`, …)
 * passes through to the inner `ScrollView` as before.
 */
export function KeyboardAvoidingScreen({
  children,
  style,
  keyboardShouldPersistTaps = 'handled',
  ...scrollViewProps
}: Props) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.flex} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...scrollViewProps}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
