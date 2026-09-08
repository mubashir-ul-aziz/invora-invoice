import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { TemplateCard } from '@/components/settings/TemplateCard';
import { settingsWithTemplate } from '@/domain/business/formMapping';
import { INVOICE_TEMPLATE_OPTIONS, type InvoiceTemplate } from '@/domain/business/types';
import type { RootStackParamList } from '@/navigation/types';
import { useInvoiceSettingsStore } from '@/state/invoiceSettingsStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'InvoiceTemplates'>;

/**
 * Invoice Templates (Phase 10) — a dedicated Classic/Modern/Compact picker
 * with a short description of each, reusing `INVOICE_TEMPLATE_OPTIONS`
 * (Phase 2/9) and `invoiceSettingsStore` (Phase 2) rather than introducing a
 * second store/repository method for one field — see `settingsWithTemplate`'s
 * doc comment. Picking a template saves immediately (no separate "Save"
 * step), mirroring `InvoiceTypeSelectionScreen`'s fixed-type tap-to-save
 * behavior.
 */
export function InvoiceTemplatesScreen({ navigation }: Props) {
  const { status, settings, error, load, save } = useInvoiceSettingsStore();

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.centered} testID="invoice-templates-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.centered} testID="invoice-templates-error">
        <Text style={styles.errorText}>Couldn't load your invoice template.</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <ActionButton label="Try again" onPress={load} />
      </View>
    );
  }

  const selected = settings?.defaultInvoiceTemplate ?? 'classic';

  const selectTemplate = async (template: InvoiceTemplate) => {
    try {
      await save(settingsWithTemplate(settings, template));
    } catch {
      Alert.alert("Couldn't save", 'Your invoice template could not be saved. Please try again.');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="invoice-templates-screen"
    >
      <Text style={styles.hint}>
        Choose the layout new invoice PDFs use. You can change this any time — nothing already
        generated changes retroactively.
      </Text>

      {INVOICE_TEMPLATE_OPTIONS.map((option) => (
        <TemplateCard
          key={option.value}
          label={option.label}
          description={option.description}
          selected={selected === option.value}
          testID={`template-card-${option.value}`}
          onPress={() => selectTemplate(option.value)}
        />
      ))}

      <ActionButton label="Done" variant="primary" onPress={() => navigation.goBack()} testID="action-done" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  hint: { fontSize: 13, color: colors.textMuted },
});
