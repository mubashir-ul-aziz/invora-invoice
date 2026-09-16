import { Feather } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { FieldToggleRow } from '@/components/invoiceType/FieldToggleRow';
import { CUSTOM_BUILDER_FIELD_KEYS, FIELD_DEFINITIONS, type FieldKey } from '@/domain/invoiceType/fieldCatalog';
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

/** Icon + one-line description per field — decorative, matches the Stitch design's per-row icon/description. */
const FIELD_META: Record<FieldKey, { icon: keyof typeof Feather.glyphMap; description: string }> = {
  itemName: { icon: 'tag', description: 'Primary product or service headline' },
  description: { icon: 'align-left', description: 'Detailed specifications and notes' },
  sku: { icon: 'hash', description: 'Inventory identifier or serial number' },
  quantity: { icon: 'layers', description: 'Number of units billed' },
  unit: { icon: 'package', description: 'Custom unit label per item' },
  weight: { icon: 'anchor', description: 'Gross, tare, or net physical weight' },
  length: { icon: 'move', description: 'Length measurement' },
  width: { icon: 'maximize', description: 'Width measurement' },
  height: { icon: 'trending-up', description: 'Height measurement' },
  weightUnit: { icon: 'anchor', description: '' },
  lengthUnit: { icon: 'move', description: '' },
  timeUnit: { icon: 'clock', description: '' },
  unitPrice: { icon: 'dollar-sign', description: 'Base cost per specified unit' },
  discount: { icon: 'percent', description: 'Line-level percentage reduction' },
  tax: { icon: 'clipboard', description: 'Specific tax category or exemption' },
};

/** Groups the 12 `CUSTOM_BUILDER_FIELD_KEYS` into the Stitch design's three sections. */
const SECTIONS: { title: string; keys: FieldKey[] }[] = [
  { title: 'Identification', keys: ['itemName', 'description', 'sku'] },
  { title: 'Measurement & Quantity', keys: ['quantity', 'unit', 'weight', 'length', 'width', 'height'] },
  { title: 'Pricing & Taxation', keys: ['unitPrice', 'discount', 'tax'] },
];

/**
 * "Custom Invoice Type" screen (Phase 3): lets the business owner pick
 * exactly which fields from the catalog (`ALL_FIELD_KEYS`) appear on a
 * custom invoice line. The checklist is generated from the catalog, not
 * hand-written per field, so a new catalog entry shows up automatically.
 *
 * Restyled to match the Stitch design: a live sample-line preview card
 * (clearly a placeholder example, not real invoice data — nothing here is
 * fetched from any real invoice), three grouped sections (Identification /
 * Measurement & Quantity / Pricing & Taxation) using `FieldToggleRow`'s new
 * icon+description+switch look, and a real "N of M optional fields active"
 * counter. Item Name and Unit Price stay locked-on exactly as before.
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
  const previewLabels = CUSTOM_BUILDER_FIELD_KEYS.filter((key) => liveValues[key]).map(
    (key) => FIELD_DEFINITIONS[key].label,
  );
  const optionalKeys = CUSTOM_BUILDER_FIELD_KEYS.filter((key) => !FIELD_DEFINITIONS[key].alwaysIncluded);
  const activeOptionalCount = optionalKeys.filter((key) => liveValues[key]).length;

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

      {/* Live preview — a placeholder sample line, not real invoice data. */}
      <View style={styles.previewCard} testID="custom-invoice-type-preview">
        <View style={styles.previewHeaderRow}>
          <View style={styles.previewHeaderLeft}>
            <View style={styles.previewDot} />
            <Text style={styles.previewEyebrow}>Live Preview</Text>
          </View>
          <View style={styles.previewClientTag}>
            <Feather name="eye" size={11} color={colors.textMuted} />
            <Text style={styles.previewClientTagText}>Client view</Text>
          </View>
        </View>
        <Text style={styles.previewCaption}>Shows how a line item's fields render — sample values, not real data.</Text>

        <View style={styles.previewSample}>
          <View style={styles.previewSampleTopRow}>
            <View style={styles.flexShrink}>
              <Text style={styles.previewSampleName}>Sample Catalog Item</Text>
              {(liveValues.description || liveValues.sku) && (
                <Text style={styles.previewSampleSubtitle} numberOfLines={1}>
                  {[liveValues.sku ? 'SKU: DEMO-001' : null, liveValues.description ? 'Sample description' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </View>
            <Text style={styles.previewSampleTotal}>120.00</Text>
          </View>
          <View style={styles.previewChipRow}>
            {!!liveValues.quantity && <PreviewChip label={`Qty: 2${liveValues.unit ? ' pcs' : ''}`} />}
            {!!liveValues.weight && <PreviewChip label="Weight: 4.5 kg" />}
            {(!!liveValues.length || !!liveValues.width || !!liveValues.height) && <PreviewChip label="Dim: 24×5×3 cm" />}
            <PreviewChip label="Rate: 60.00" />
            {!!liveValues.discount && <PreviewChip label="Disc: -5%" tone="tertiary" />}
            {!!liveValues.tax && <PreviewChip label="Tax: 20%" />}
          </View>
        </View>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.keys.length} fields</Text>
          </View>
          <View style={styles.sectionCard}>
            {section.keys.map((key, index) => {
              const definition = FIELD_DEFINITIONS[key];
              const meta = FIELD_META[key];
              return (
                <React.Fragment key={key}>
                  {index > 0 && <View style={styles.divider} />}
                  <Controller
                    control={control}
                    name={key}
                    render={({ field: { value, onChange } }) => (
                      <FieldToggleRow
                        label={definition.label}
                        description={meta.description}
                        icon={meta.icon}
                        checked={!!value}
                        disabled={definition.alwaysIncluded}
                        onToggle={() => onChange(!value)}
                        testID={`custom-field-${key}`}
                      />
                    )}
                  />
                </React.Fragment>
              );
            })}
          </View>
        </View>
      ))}

      <ActionButton
        label={isSubmitting || status === 'saving' ? 'Saving…' : 'Save Custom Configuration'}
        variant="primary"
        icon="check"
        onPress={onSubmit}
        disabled={isSubmitting || status === 'saving'}
        testID="save-custom-invoice-type"
      />
      <Text style={styles.counterText}>
        {activeOptionalCount} of {optionalKeys.length} optional fields active · Syncs across all templates
      </Text>
    </ScrollView>
  );
}

function PreviewChip({ label, tone = 'default' }: { label: string; tone?: 'default' | 'tertiary' }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipText, tone === 'tertiary' && styles.chipTextTertiary]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
  errorDetail: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: -4 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  previewHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  previewEyebrow: { fontSize: 10, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  previewClientTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  previewClientTagText: { fontSize: 10, color: colors.textMuted },
  previewCaption: { fontSize: 11, color: colors.textMuted },

  previewSample: { backgroundColor: colors.background, borderRadius: 12, padding: 12, gap: 8, marginTop: 4 },
  previewSampleTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  previewSampleName: { fontSize: 14, fontWeight: '700', color: colors.text },
  previewSampleSubtitle: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  previewSampleTotal: { fontSize: 15, fontWeight: '700', color: colors.text },
  previewChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11, color: colors.text },
  chipTextTertiary: { color: '#1E7B41', fontWeight: '600' },

  section: { gap: 6 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionCount: { fontSize: 11, color: colors.textMuted },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  divider: { height: 1, backgroundColor: colors.background, marginHorizontal: 12 },

  counterText: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
