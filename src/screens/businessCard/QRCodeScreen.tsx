import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { RootStackParamList } from '@/navigation/types';
import { useBusinessCardStore } from '@/state/businessCardStore';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'QRCode'>;

/**
 * Renders the QR code entirely on-device (react-native-qrcode-svg draws it
 * as local SVG — no network call, no server). The encoded value is the
 * card's share link, resolved by the injected ShareLinkService.
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

  return (
    <View style={styles.screen} testID="qr-screen">
      <View style={styles.qrWrapper} testID="qr-wrapper">
        <QRCode value={shareLink} size={220} backgroundColor={colors.surface} />
      </View>
      <Text style={styles.businessName}>{card.businessName}</Text>
      <Text style={styles.link} numberOfLines={2} testID="qr-link-text">
        {shareLink}
      </Text>
      <Text style={styles.hint}>Scan this code to open the business card.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', padding: 24, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
  qrWrapper: {
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 24,
  },
  businessName: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  link: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
