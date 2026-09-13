import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface Props {
  label: string;
  /** `YYYY-MM-DD`, or `''` when nothing is selected yet. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  testID?: string;
  /**
   * Latest selectable day, inclusive. Defaults to today, so the calendar
   * can't select an upcoming date — pass `null` to lift that (e.g. an
   * invoice due date, which is allowed to be in the future).
   */
  maximumDate?: Date | null;
  /**
   * Earliest selectable day, inclusive. Defaults to `null` (no lower bound)
   * — pass today (e.g. an invoice due date, which shouldn't be backdated)
   * to restrict the calendar to upcoming dates only.
   */
  minimumDate?: Date | null;
}

/** Parses a `YYYY-MM-DD` string as a local calendar date (never shifts a day due to UTC conversion). Exported so callers can turn a stored ISO date into a `minimumDate`/`maximumDate` prop without duplicating this parsing. */
export function parseIsoDateLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Inverse of `parseIsoDateLocal` — reads the date's local calendar fields, not UTC ones. */
function toIsoDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string): string {
  const date = parseIsoDateLocal(value);
  if (!date) {
    return '';
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Tap-to-open native calendar date field. Used for Payment date (see
 * `PaymentFormFields`) in place of a free-typed `YYYY-MM-DD` text field —
 * tapping it opens the device's real calendar UI, and `maximumDate`
 * (today, by default) grays out/blocks any day after it so an upcoming date
 * can't be picked.
 */
export function DateField({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder = 'Select a date',
  testID,
  maximumDate = new Date(),
  minimumDate = null,
}: Props) {
  const [open, setOpen] = useState(false);

  const close = () => {
    setOpen(false);
    onBlur?.();
  };

  const selectedDate = parseIsoDateLocal(value) ?? new Date();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        onPress={() => setOpen(true)}
        style={[styles.input, !!error && styles.inputError]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
        <Feather name="calendar" size={18} color={colors.textMuted} />
      </Pressable>
      {!!error && (
        <Text style={styles.error} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      )}

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          maximumDate={maximumDate ?? undefined}
          minimumDate={minimumDate ?? undefined}
          onValueChange={(_event, date) => {
            setOpen(false);
            onBlur?.();
            if (date) {
              onChange(toIsoDateLocal(date));
            }
          }}
          onDismiss={close}
        />
      )}

      {open && Platform.OS !== 'android' && (
        <Modal transparent animationType="fade" visible={open} onRequestClose={close}>
          <Pressable style={styles.backdrop} onPress={close} testID={testID ? `${testID}-backdrop` : undefined}>
            {/* Swallow taps inside the sheet so they don't fall through to the backdrop's dismiss handler. */}
            <Pressable style={styles.sheet} onPress={() => undefined}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="inline"
                maximumDate={maximumDate ?? undefined}
                minimumDate={minimumDate ?? undefined}
                onValueChange={(_event, date) => onChange(toIsoDateLocal(date))}
              />
              <Pressable
                accessibilityRole="button"
                style={styles.doneButton}
                onPress={close}
                testID={testID ? `${testID}-done` : undefined}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  value: { fontSize: 15, color: colors.text },
  placeholder: { color: colors.placeholder },
  error: { fontSize: 12, color: colors.danger },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 8,
  },
  doneButton: { alignItems: 'center', paddingVertical: 14 },
  doneButtonText: { fontSize: 15, fontWeight: '700', color: colors.primary },
});
