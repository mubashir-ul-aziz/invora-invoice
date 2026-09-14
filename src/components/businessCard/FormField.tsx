import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/theme/colors';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  testID?: string;
}

/** Textarea-style fields (`multiline`) always show room for at least this many lines, even with no `numberOfLines` override. */
const MIN_MULTILINE_LINES = 3;
const LINE_HEIGHT = 20;

export function FormField({ label, error, testID, style, ...inputProps }: Props) {
  const minLines = inputProps.multiline
    ? Math.max(inputProps.numberOfLines ?? 0, MIN_MULTILINE_LINES)
    : undefined;
  return (
    <View style={styles.container}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        {...inputProps}
        testID={testID}
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          inputProps.multiline && [styles.multilineInput, { minHeight: minLines! * LINE_HEIGHT + 20 }],
          !!error && styles.inputError,
          style,
        ]}
      />
      {!!error && (
        <Text style={styles.error} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multilineInput: { textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 12, color: colors.danger },
});
