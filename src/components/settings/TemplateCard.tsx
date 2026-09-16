import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { InvoiceTemplate } from '@/domain/business/types';
import { colors } from '@/theme/colors';

interface Props {
  template: InvoiceTemplate;
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/** A short category tag per template — decorative, matches the Stitch mock's per-card badge. */
const CATEGORY_TAG: Record<InvoiceTemplate, string> = {
  classic: 'Traditional / Formal',
  modern: 'Most Popular',
  compact: 'Eco Print / Dense',
};

/**
 * One selectable invoice template on the Invoice Templates screen. Restyled
 * to match the Stitch design: a radio indicator, a category tag, a small
 * preview swatch that mirrors what `renderInvoiceHtml()` actually produces
 * for this template (serif/bordered for Classic, a blue header band for
 * Modern, dense small rows for Compact — see that file's `TEMPLATE_CSS`),
 * and the template's real description.
 */
export function TemplateCard({ template, label, description, selected, onPress, testID }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.pressed]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.radio, selected && styles.radioSelected]}>
            {selected && <Feather name="check" size={13} color={colors.primaryText} />}
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{CATEGORY_TAG[template]}</Text>
            </View>
          </View>
        </View>
        {selected && (
          <View style={styles.activeRow}>
            <Text style={styles.activeText}>ACTIVE</Text>
            <Feather name="check-circle" size={16} color={colors.primary} />
          </View>
        )}
      </View>

      <TemplatePreview template={template} />

      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

/** Decorative but accurate mini preview — mirrors each template's real look in `renderInvoiceHtml.ts`. Exported so other screens picking a template (e.g. Invoice PDF Preview's own template grid) reuse the same swatch instead of redrawing it. */
export function TemplatePreview({ template }: { template: InvoiceTemplate }) {
  if (template === 'classic') {
    return (
      <View style={styles.previewFrame}>
        <View style={styles.previewSheetClassic}>
          <View style={styles.previewClassicHeaderRow}>
            <Text style={styles.previewClassicBusiness}>YOUR BUSINESS</Text>
            <Text style={styles.previewClassicMeta}>INVOICE #0001</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewRow}>
            <Text style={styles.previewClassicItem}>Line item</Text>
            <Text style={styles.previewClassicItem}>120.00</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewClassicItem}>Line item</Text>
            <Text style={styles.previewClassicItem}>80.00</Text>
          </View>
        </View>
      </View>
    );
  }
  if (template === 'modern') {
    return (
      <View style={styles.previewFrame}>
        <View style={styles.previewSheetModern}>
          <View style={styles.previewModernBand}>
            <Text style={styles.previewModernBandText}>YOUR BUSINESS</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewModernItem}>Line item</Text>
            <Text style={styles.previewModernAmount}>120.00</Text>
          </View>
          <View style={styles.previewModernTotalRow}>
            <Text style={styles.previewModernTotalLabel}>Total</Text>
            <Text style={styles.previewModernTotalValue}>200.00</Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.previewFrame}>
      <View style={styles.previewSheetCompact}>
        {['01', '02', '03', '04'].map((n) => (
          <View key={n} style={styles.previewCompactRow}>
            <Text style={styles.previewCompactItem}>{n}. Line item</Text>
            <Text style={styles.previewCompactItem}>40.00</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardSelected: { borderWidth: 2, borderColor: colors.primary },
  pressed: { opacity: 0.9 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.primary },
  headerTextCol: { gap: 4, minWidth: 0 },
  label: { fontSize: 16, fontWeight: '700', color: colors.text },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeText: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.4 },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  previewFrame: { backgroundColor: colors.background, borderRadius: 10, padding: 10 },

  previewSheetClassic: { backgroundColor: colors.surface, borderRadius: 6, padding: 10, gap: 6 },
  previewClassicHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewClassicBusiness: { fontSize: 9, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
  previewClassicMeta: { fontSize: 8, color: colors.textMuted },
  previewDivider: { height: 1, backgroundColor: colors.border },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewClassicItem: { fontSize: 8, color: colors.text },

  previewSheetModern: { backgroundColor: colors.surface, borderRadius: 6, padding: 8, gap: 6, overflow: 'hidden' },
  previewModernBand: { backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5 },
  previewModernBandText: { fontSize: 8, fontWeight: '700', color: colors.primaryText, letterSpacing: 0.3 },
  previewModernItem: { fontSize: 8, color: colors.text },
  previewModernAmount: { fontSize: 8, fontWeight: '700', color: colors.primary },
  previewModernTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewModernTotalLabel: { fontSize: 8, fontWeight: '600', color: colors.text },
  previewModernTotalValue: { fontSize: 8, fontWeight: '700', color: colors.primary },

  previewSheetCompact: { backgroundColor: colors.surface, borderRadius: 6, padding: 8, gap: 2 },
  previewCompactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  previewCompactItem: { fontSize: 7, color: colors.text },
});
