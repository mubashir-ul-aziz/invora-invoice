import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import { ALL_FIELD_KEYS, FIELD_DEFINITIONS } from '@/domain/invoiceType/fieldCatalog';
import { selectionToCustomFormDefaults } from '@/domain/invoiceType/formMapping';
import {
  customFieldSelectionFormSchema,
  type CustomFieldSelectionFormOutput,
  type CustomFieldSelectionFormValues,
} from '@/domain/invoiceType/validation';
import type { RootStackParamList } from '@/navigation/types';
import { useInvoiceTypeStore } from '@/state/invoiceTypeStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomInvoiceType'>;

/**
 * "Custom Invoice Type" screen (Phase 3): lets the business owner pick
 * exactly which fields from the catalog (`ALL_FIELD_KEYS`) appear on a
 * custom invoice line. The checklist is generated from the catalog, not
 * hand-written per field, so a new catalog entry shows up automatically.
 */
export function CustomInvoiceTypeScreen({ navigation }: Props) {
  const { status, selection, error, load, save } = useInvoiceTypeStore();

  useEffect(() => {
    load();
  }, [load]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CustomFieldSelectionFormValues, unknown, CustomFieldSelectionFormOutput>({
    resolver: zodResolver(customFieldSelectionFormSchema),
    defaultValues: selectionToCustomFormDefaults(selection),
  });

  // Re-seed the form once the current selection finishes loading —
  // `defaultValues` above only applies on first mount.
  useEffect(() => {
    if (status === 'ready') {
      reset(selectionToCustomFormDefaults(selection));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const liveValues = useWatch({ control });
  const previewLabels = ALL_FIELD_KEYS.filter((key) => liveValues[key]).map(
    (key) => FIELD_DEFINITIONS[key].label,
  );

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered} testID="custom-invoice-type-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="custom-invoice-type-error">
        <Text style={styles.errorText}>Couldn't load your custom invoice fields.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <ActionButton label="Try again" onPress={load} />
      </View>
    );
  }

  const onSubmit = handleSubmit(async (fieldKeys) => {
    try {
      await save({ invoiceTypeId: 'custom', customFieldKeys: fieldKeys });
      navigation.goBack();
    } catch {
      Alert.alert(
        "Couldn't save",
        'Your custom invoice fields could not be saved. Please try again.',
      );
    }
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="custom-invoice-type-screen"
    >
      <Text style={styles.hint}>
        Choose which fields appear on a custom invoice line. Item Name and Unit Price are always
        included.
      </Text>

      {ALL_FIELD_KEYS.map((key) => {
        const definition = FIELD_DEFINITIONS[key];
        return (
          <Controller
            key={key}
            control={control}
            name={key}
            render={({ field: { value, onChange } }) => (
              <FieldToggleRow
                label={definition.label}
                checked={!!value}
                disabled={definition.alwaysIncluded}
                onToggle={() => onChange(!value)}
                testID={`custom-field-${key}`}
              />
            )}
          />
        );
      })}

      <View style={styles.previewCard} testID="custom-invoice-type-preview">
        <Text style={styles.previewLabel}>Preview</Text>
        <Text style={styles.previewText}>{previewLabels.join(', ')}</Text>
      </View>

      <ActionButton
        label={isSubmitting || status === 'saving' ? 'Saving…' : 'Save'}
        variant="primary"
        onPress={onSubmit}
        disabled={isSubmitting || status === 'saving'}
        testID="save-custom-invoice-type"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  hint: { fontSize: 13, color: colors.textMuted },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
    marginTop: 6,
  },
  previewLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  previewText: { fontSize: 13, color: colors.text },
});
