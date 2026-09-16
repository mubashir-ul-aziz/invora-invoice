import { Feather } from '@expo/vector-icons';
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
 * doc comment.
 *
 * Restyled to match the Stitch "Invoice Templates" design: a "current active
 * layout" status pill, per-template cards with a real preview swatch
 * mirroring `renderInvoiceHtml()`'s actual per-template styling (see
 * `TemplateCard`). The Stitch mock's flow is "select, then tap a bottom Save
 * button" — this app's real behavior (unchanged from before the restyle,
 * matching `InvoiceTypeSelectionScreen`'s fixed-type pattern) saves
 * immediately on tap, so the bottom button stays a plain "Done" rather than
 * a second save step that doesn't exist.
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
  const selectedOption = INVOICE_TEMPLATE_OPTIONS.find((option) => option.value === selected);

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
      <Text style={styles.hint}>Choose how your exported PDFs and client links look to customers.</Text>

      <View style={styles.activePill}>
        <View style={styles.activeDot} />
        <Text style={styles.activePillText}>
          Current active layout: <Text style={styles.activePillTextBold}>{selectedOption?.label ?? 'Classic'}</Text>
        </Text>
      </View>

      {INVOICE_TEMPLATE_OPTIONS.map((option) => (
        <TemplateCard
          key={option.value}
          template={option.value}
          label={option.label}
          description={option.description}
          selected={selected === option.value}
          testID={`template-card-${option.value}`}
          onPress={() => selectTemplate(option.value)}
        />
      ))}

      <Text style={styles.footnote}>You can change this any time — nothing already generated changes retroactively.</Text>

      <ActionButton label="Done" variant="primary" icon="check" onPress={() => navigation.goBack()} testID="action-done" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: -4 },

  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  activePillText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  activePillTextBold: { color: colors.primary, fontWeight: '700' },

  footnote: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
