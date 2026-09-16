import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/businessCard/ActionButton';
import { CardPreview } from '@/components/businessCard/CardPreview';
import { buildShareMessage } from '@/domain/businessCard/shareText';
import { openEmail, openSms, shareViaWhatsApp } from '@/lib/linking';
import type { RootStackParamList } from '@/navigation/types';
import { useBusinessCardStore } from '@/state/businessCardStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ShareCard'>;

/**
 * Uses the native share sheet — works with or without internet; no backend involved.
 *
 * Restyled to match the Stitch "Share Card" design's Quick Share grid +
 * Direct Link + additional-options list. The direct link shown is the
 * real, app-generated share link (`invora://card/{slug}` — a deep link,
 * not a web URL; this app has no web backend/domain like Stitch's fake
 * "invora.me"). WhatsApp/Email/SMS quick-share icons are real: each opens
 * the OS's own compose UI pre-filled with the same message the native
 * share sheet already sends (`buildShareMessage`), via `shareViaWhatsApp`/
 * `openEmail`/`openSms` in `lib/linking` (the last two new, minimal
 * additions mirroring the existing `openWhatsApp`/`openGoogleMaps`
 * pattern — no new dependency, just more `Linking` URL schemes). The
 * direct-link text is `selectable` so it can be copied via the OS's own
 * text-selection UI — this app has no clipboard library, so a fake "Copy"
 * button is skipped rather than added as inert chrome. "Save contact file
 * (.vCard)" and "Export as PDF summary" are DESIGN ONLY: nothing in this
 * app exports a standalone .vcf file or a card-summary PDF (PDF generation
 * exists only for invoices). Stitch's "Verified" badge is dropped (no
 * verification concept exists for a business card).
 */
export function ShareCardScreen({ navigation }: Props) {
  const { card, getShareLink } = useBusinessCardStore();
  const shareLink = getShareLink();

  const onShare = async () => {
    if (!card || !shareLink) return;
    try {
      await Share.share({
        message: buildShareMessage(card, shareLink),
        title: card.businessName,
      });
    } catch {
      // The user cancelling the share sheet also lands here on some platforms — no-op.
    }
  };

  const notAvailable = (what: string) => Alert.alert('Not available', `${what} is not implemented yet.`);

  if (!card || !shareLink) {
    return (
      <View style={styles.centered} testID="share-empty">
        <Text style={styles.emptyText}>Set up your business card first to share it.</Text>
      </View>
    );
  }

  const message = buildShareMessage(card, shareLink);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="share-card-screen">
      <CardPreview card={card} />

      <Text style={styles.sectionHeader}>Quick Share</Text>
      <View style={styles.quickShareRow}>
        <QuickShareButton
          icon="message-circle"
          label="WhatsApp"
          onPress={() => shareViaWhatsApp(message)}
          testID="quick-share-whatsapp"
        />
        <QuickShareButton
          icon="mail"
          label="Email"
          onPress={() => openEmail('', { subject: `Digital Business Card — ${card.businessName}`, body: message })}
          testID="quick-share-email"
        />
        <QuickShareButton icon="message-square" label="SMS" onPress={() => openSms(message)} testID="quick-share-sms" />
        <QuickShareButton icon="share-2" label="More" onPress={onShare} testID="quick-share-more" />
      </View>

      <View style={styles.linkCard}>
        <Text style={styles.linkLabel}>Direct Link</Text>
        <View style={styles.linkRow}>
          <Feather name="link" size={16} color={colors.textMuted} />
          <Text style={styles.linkText} selectable testID="share-link-text">
            {shareLink}
          </Text>
        </View>
      </View>

      <View style={styles.optionsCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save contact file — DESIGN ONLY, not implemented"
          testID="action-save-vcard-design-only"
          onPress={() => notAvailable('Saving a .vCard file')}
          style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}
        >
          <View style={styles.optionIcon}>
            <Feather name="user-plus" size={17} color={colors.primary} />
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.optionLabel}>Save contact file (.vCard) · DESIGN ONLY</Text>
            <Text style={styles.optionCaption}>Imports directly to phone contacts</Text>
          </View>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export as PDF summary — DESIGN ONLY, not implemented"
          testID="action-export-pdf-summary-design-only"
          onPress={() => notAvailable('Exporting a PDF summary')}
          style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}
        >
          <View style={styles.optionIcon}>
            <Feather name="file-text" size={17} color={colors.primary} />
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.optionLabel}>Export as PDF summary · DESIGN ONLY</Text>
            <Text style={styles.optionCaption}>Print-ready portfolio sheet</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.row}>
        <ActionButton label="Share business card" icon="share-2" variant="primary" onPress={onShare} testID="share-button" />
        <ActionButton
          label="QR code"
          icon="grid"
          onPress={() => navigation.navigate('QRCode')}
          testID="share-qr-button"
        />
      </View>
    </ScrollView>
  );
}

function QuickShareButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.quickShareButton, pressed && styles.pressed]}
    >
      <View style={styles.quickShareIcon}>
        <Feather name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.quickShareLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  pressed: { opacity: 0.75 },
  flexShrink: { flexShrink: 1, minWidth: 0 },

  sectionHeader: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  quickShareRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  quickShareButton: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 8 },
  quickShareIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quickShareLabel: { fontSize: 11, fontWeight: '600', color: colors.text },

  linkCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  linkLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  linkText: { fontSize: 12, color: colors.text, fontWeight: '600', flexShrink: 1 },

  optionsCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  optionIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  optionCaption: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.background, marginLeft: 60 },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
