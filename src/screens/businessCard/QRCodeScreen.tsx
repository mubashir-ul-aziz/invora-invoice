import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { RootStackParamList } from '@/navigation/types';
import { useBusinessCardStore } from '@/state/businessCardStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'QRCode'>;

/**
 * Renders the QR code entirely on-device (react-native-qrcode-svg draws it
 * as local SVG — no network call, no server). The encoded value is the
 * card's share link, resolved by the injected ShareLinkService.
 *
 * Restyled to match the Stitch "QR Code" design's card + action-hierarchy
 * layout. "Share QR Link" is real — the same native `Share.share` sheet
 * `ShareCardScreen` uses, sharing the real encoded link. "Save Image", "Add
 * to Wallet", and "Print Desk Standee (PDF)" are DESIGN ONLY: this app has
 * no photo-library/wallet-pass integration, and PDF generation exists only
 * for invoices, not a card standee. Stitch's "Live vCard 2.1 Sync" badge is
 * dropped — the QR code here encodes the app's `invora://card/{slug}` deep
 * link (asserted by this screen's tests), not vCard-formatted data, so that
 * claim would be inaccurate; its "Verified" badge is dropped too (no
 * verification concept exists for a business card).
 */
export function QRCodeScreen({}: Props) {
  const { card, getShareLink } = useBusinessCardStore();
  const shareLink = getShareLink();

  if (!card || !shareLink) {
    return (
      <View style={styles.centered} testID="qr-empty">
        <Text style={styles.emptyText}>Set up your business card first to generate a QR code.</Text>
      </View>
    );
  }

  const onShare = async () => {
    try {
      await Share.share({ message: `${card.businessName}\n${shareLink}`, title: card.businessName });
    } catch {
      // The user cancelling the share sheet also lands here on some platforms — no-op.
    }
  };

  const notAvailable = (what: string) => Alert.alert('Not available', `${what} is not implemented yet.`);

  return (
    <View style={styles.screen} testID="qr-screen">
      <View style={styles.identityRow}>
        {card.logoUri ? (
          <Image source={{ uri: card.logoUri }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>{card.businessName.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.businessName}>{card.businessName}</Text>
        <Text style={styles.subtitle}>Scan to save contact or open card</Text>
      </View>

      <View style={styles.qrWrapper} testID="qr-wrapper">
        <QRCode value={shareLink} size={220} backgroundColor={colors.surface} />
      </View>

      <Text style={styles.link} numberOfLines={2} testID="qr-link-text">
        {shareLink}
      </Text>

      <View style={styles.hintRow}>
        <Feather name="crosshair" size={16} color={colors.primary} />
        <Text style={styles.hint}>
          Anyone can scan this code with their phone camera to instantly view this digital card.
        </Text>
      </View>

      <View style={styles.actions}>
        <ActionRow label="Share QR Link" icon="share-2" primary onPress={onShare} testID="qr-action-share" />
        <View style={styles.actionsGrid}>
          <ActionRow
            label="Save Image · DESIGN ONLY"
            icon="download"
            onPress={() => notAvailable('Saving the QR code image')}
            testID="qr-action-save-image-design-only"
            compact
          />
          <ActionRow
            label="Add to Wallet · DESIGN ONLY"
            icon="credit-card"
            onPress={() => notAvailable('Adding a Wallet pass')}
            testID="qr-action-wallet-design-only"
            compact
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Print desk standee — DESIGN ONLY, not implemented"
          testID="qr-action-print-design-only"
          onPress={() => notAvailable('Printing a desk standee PDF')}
          style={({ pressed }) => [styles.printRow, pressed && styles.pressed]}
        >
          <Feather name="printer" size={16} color={colors.textMuted} />
          <Text style={styles.printText}>Print Desk Standee (PDF) · DESIGN ONLY</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ActionRow({
  label,
  icon,
  onPress,
  testID,
  primary,
  compact,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  testID?: string;
  primary?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        primary && styles.actionButtonPrimary,
        compact && styles.actionButtonCompact,
        pressed && styles.pressed,
      ]}
    >
      <Feather name={icon} size={18} color={primary ? colors.primaryText : colors.text} />
      <Text style={[styles.actionButtonText, primary && styles.actionButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', padding: 24, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  pressed: { opacity: 0.75 },

  identityRow: { alignItems: 'center', gap: 3, marginBottom: 4 },
  logo: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surface },
  logoPlaceholder: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoPlaceholderText: { color: colors.primaryText, fontSize: 18, fontWeight: '700' },
  businessName: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 6 },
  subtitle: { fontSize: 12, color: colors.textMuted },

  qrWrapper: {
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  link: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: 320, marginTop: 4 },
  hint: { fontSize: 12, color: colors.textMuted, flexShrink: 1, textAlign: 'left' },

  actions: { width: '100%', maxWidth: 340, gap: 10, marginTop: 8 },
  actionsGrid: { flexDirection: 'row', gap: 10 },
  actionButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonPrimary: { backgroundColor: colors.primary },
  actionButtonCompact: { flex: 1 },
  actionButtonText: { fontSize: 13, fontWeight: '600', color: colors.text },
  actionButtonTextPrimary: { color: colors.primaryText },

  printRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  printText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
});
