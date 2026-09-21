import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

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

const COMPACT_ACCENT = '#3F465C';

/** A skeleton "line/bar" placeholder — the wireframe building block every template swatch below is made of. */
function Bar({
  width,
  height = 3,
  color = colors.placeholder,
  opacity = 1,
  style,
}: {
  width: number | `${number}%`;
  height?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ width, height, borderRadius: height / 2, backgroundColor: color, opacity }, style]} />;
}

function Divider({ opacity = 0.7 }: { opacity?: number }) {
  return <View style={[styles.previewDivider, { opacity }]} />;
}

/**
 * Decorative mini preview — a scale-independent wireframe (skeleton bars, not
 * literal rendered text) so it stays legible both in the small 3-up template
 * picker grid (Invoice PDF Preview) and the larger single-column list
 * (Invoice Templates). Matches the Stitch design's own skeleton-bar swatch —
 * real business-name/line-item text at these sizes overflowed and wrapped.
 * Exported so other screens picking a template reuse the same swatch instead
 * of redrawing it.
 */
export function TemplatePreview({ template }: { template: InvoiceTemplate }) {
  if (template === 'classic') {
    return (
      <View style={styles.previewFrame}>
        <View style={styles.previewGroup}>
          <Bar width="55%" height={5} />
          <Bar width="75%" height={3} opacity={0.6} style={styles.previewGapSm} />
        </View>
        <View style={styles.previewGroup}>
          <Divider />
          <View style={styles.previewRow}>
            <Bar width="40%" height={3} />
            <Bar width="18%" height={3} />
          </View>
          <Divider opacity={0.35} />
          <View style={styles.previewRow}>
            <Bar width="32%" height={3} />
            <Bar width="18%" height={3} />
          </View>
          <Divider />
        </View>
        <View style={styles.previewRowEnd}>
          <Bar width="32%" height={5} />
        </View>
      </View>
    );
  }
  if (template === 'modern') {
    return (
      <View style={styles.previewFrame}>
        <View style={styles.previewRow}>
          <Bar width={7} height={7} color={colors.primary} style={styles.previewSquare} />
          <Bar width="40%" height={5} color={colors.primary} />
        </View>
        <View style={styles.previewGroup}>
          <Bar width="100%" height={7} color={colors.surface} />
          <View style={styles.previewGapSm}>
            <Bar width="100%" height={3} opacity={0.5} />
            <Bar width="85%" height={3} opacity={0.4} style={styles.previewGapXs} />
          </View>
          <View style={styles.previewModernTotalRow}>
            <Bar width="25%" height={3} color={colors.primary} />
            <Bar width="30%" height={5} color={colors.primary} />
          </View>
        </View>
        <View style={styles.previewRow}>
          <Bar width={6} height={6} color={colors.border} style={styles.previewSquare} />
          <Bar width="50%" height={3} opacity={0.6} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.previewFrame}>
      <View style={styles.previewRow}>
        <Bar width="33%" height={3} color={COMPACT_ACCENT} />
        <Bar width="25%" height={3} color={COMPACT_ACCENT} />
      </View>
      <View style={styles.previewGroup}>
        <Divider />
        {[0, 1, 2, 3].map((n) => (
          <Bar key={n} width="100%" height={3} opacity={0.55} style={n > 0 ? styles.previewGapXs : undefined} />
        ))}
        <Divider />
      </View>
      <View style={styles.previewRow}>
        <Bar width="25%" height={3} color={COMPACT_ACCENT} />
        <Bar width="30%" height={5} color={COMPACT_ACCENT} />
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

  previewFrame: {
    aspectRatio: 0.78,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: '9%',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  previewGroup: { gap: 4 },
  previewGapSm: { marginTop: 4 },
  previewGapXs: { marginTop: 2 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewRowEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
  previewSquare: { borderRadius: 2 },
  previewDivider: { height: 1, backgroundColor: colors.border },
  previewModernTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DCE9FF',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginTop: 4,
  },
});
